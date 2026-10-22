import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '../lib/rate-limiter';
import { getQueryCache, setQueryCache } from '../lib/query-cache';

export interface GoogleRpcRetryInfo {
    retryDelay?: string;
    [key: string]: unknown;
}

export interface GoogleGenerativeAIError extends Error {
    status?: number;
    errorDetails?: GoogleRpcRetryInfo[];
}

/**
 * Strict server-side whitelist of cost-effective, high-speed Gemini models.
 * Prevents arbitrary model injection or forced invocation of expensive tiers.
 */
const ALLOWED_GEMINI_MODELS = new Set([
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
]);

/**
 * Server-side fallback chain prioritized by quota capacity (RPM / RPD) and stability.
 */
const DEFAULT_FALLBACK_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
];

const MAX_FALLBACK_MODELS = 4;
const MAX_QUERY_LENGTH = 300;

const SYSTEM_SEARCH_ORCHESTRATOR_INSTRUCTION = `
You are an elite cinematic search engine orchestrator for the International Movie Database (TMDB).
Analyze the user's semantic search query carefully.

Your task is NOT to return a hardcoded list of movies. Instead, deduce the user's ultimate goal and return an Execution Graph of API calls that the frontend engine will execute against TMDB's Discover endpoints to provide massive, exhaustively scrollable lists.

You must return ONLY a raw, valid JSON object containing a "sections" array. Do NOT wrap output in markdown code blocks.

CRITICAL JSON SCHEMA TO FOLLOW:
{
    "sections": [
        {
            "title": "String", // e.g. "Hugh Jackman's Greatest Hits", "90s Sci-Fi Mindbenders", "Top Results"
            "action": "discover_movies" | "discover_tv" | "exact_match", // EXACT MATCH should only be used if they search for a highly specific, single movie title. Otherwise default to discover.
            "parameters": {
                "person_name": "String", // (Only if a specific actor/director/crew member is detected in the query. We will resolve their TMDB ID later)
                "genres": [Number], // TMDB Genre IDs. MAPPINGS: Action=28, Adventure=12, Animation=16, Comedy=35, Crime=80, Documentary=99, Drama=18, Family=10751, Fantasy=14, History=36, Horror=27, Music=10402, Mystery=9648, Romance=10749, Sci-Fi=878, Thriller=53, War=10752, Western=37.
                "keywords": ["String"], // 1-3 highly descriptive keyword strings (e.g., "space travel", "cyberpunk", "time loop", "plot twist"). We will resolve these to TMDB IDs later.
                "sort_by": "popularity.desc" | "primary_release_date.desc" | "primary_release_date.asc" | "vote_average.desc", // Default to popularity.desc unless "oldest", "latest", or "best" is implied.
                "query": "String" // ONLY provide this if action is 'exact_match'. The exact title of the movie/tv show/person.
            }
        }
    ]
}

EXAMPLES:
User Query: "movies about space travel with matthew mcconaughey"
Output: {"sections": [{"title": "Matthew McConaughey in Space", "action": "discover_movies", "parameters": {"person_name": "Matthew McConaughey", "genres": [878], "keywords": ["space travel", "astronaut"], "sort_by": "popularity.desc"}}]}

User Query: "that show about the crystal meth teacher"
Output: {"sections": [{"title": "Breaking Bad", "action": "exact_match", "parameters": {"query": "Breaking Bad"}}]}

User Query: "Mallika sherawat hits"
Output: {"sections": [{"title": "Mallika Sherawat Hits", "action": "discover_movies", "parameters": {"person_name": "Mallika Sherawat", "sort_by": "popularity.desc"}}]}

User Query: "Hugh Jackman movies... top 5 latest and oldest"
Output: {
    "sections": [
        {"title": "Latest Hugh Jackman", "action": "discover_movies", "parameters": {"person_name": "Hugh Jackman", "sort_by": "primary_release_date.desc"}},
        {"title": "Classic Oldest Hits", "action": "discover_movies", "parameters": {"person_name": "Hugh Jackman", "sort_by": "primary_release_date.asc"}}
    ]
}

If the query is nonsensical or unrelated to cinema/TV, return {"sections": []}.
`;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    // 2. Client Origin Guard
    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 3. IP Rate Limiting Guard (25 requests / min per IP)
    if (!checkRateLimit(req, res, { windowSec: 60, maxRequests: 25 })) {
        return res;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[API - Gemini] Missing GEMINI_API_KEY in environment.');
        return res.status(500).json({ error: 'Internal Server Configuration Error' });
    }

    try {
        const body = (req.body || {}) as { query?: unknown; models?: unknown };

        // 4. Strict Input Length & Type Validation
        if (!body.query || typeof body.query !== 'string') {
            return res.status(400).json({ error: 'Search query is required and must be a string.' });
        }

        const sanitizedQuery = body.query.trim();
        if (sanitizedQuery.length === 0) {
            return res.status(400).json({ error: 'Search query cannot be empty.' });
        }

        if (sanitizedQuery.length > MAX_QUERY_LENGTH) {
            return res.status(400).json({
                error: `Search query exceeds maximum length of ${MAX_QUERY_LENGTH} characters.`
            });
        }

        // 5. Query Response Cache (Check if recently computed)
        const cachedPayload = getQueryCache<{ sections: unknown[] }>(sanitizedQuery);
        if (cachedPayload) {
            res.setHeader('X-Cache-Status', 'HIT');
            return res.status(200).json(cachedPayload);
        }

        // 6. Model Whitelisting & Cascading Fallback Setup
        let candidateModels: string[] = [];
        if (Array.isArray(body.models)) {
            candidateModels = body.models
                .filter((m): m is string => typeof m === 'string' && ALLOWED_GEMINI_MODELS.has(m))
                .slice(0, MAX_FALLBACK_MODELS);
        }

        // Merge requested models with server-side default cascade to ensure alternative fallback tiers
        const modelsToAttempt = Array.from(new Set([...candidateModels, ...DEFAULT_FALLBACK_CASCADE])).slice(0, MAX_FALLBACK_MODELS);

        const genAI = new GoogleGenerativeAI(apiKey);
        let success = false;
        let mediaTitles: unknown[] = [];
        let lastError: unknown = null;
        let quotaError: unknown = null;

        console.log(`[API - Gemini Fallback] Starting Cascading Fallback Loop for query length: ${sanitizedQuery.length}. Candidates: ${modelsToAttempt.join(', ')}`);

        // 7. Fallback Model Engine with Native systemInstruction Separation
        for (const modelId of modelsToAttempt) {
            try {
                console.log(`[API - Gemini Fallback] Attempting Model: ${modelId}`);

                const model = genAI.getGenerativeModel({
                    model: modelId,
                    systemInstruction: {
                        role: 'system',
                        parts: [{ text: SYSTEM_SEARCH_ORCHESTRATOR_INSTRUCTION }]
                    },
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.2
                    }
                });

                // User input isolated cleanly into user message turn
                const result = await model.generateContent({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: `User Query: ${JSON.stringify(sanitizedQuery)}` }]
                        }
                    ]
                });

                const responseText: string = result.response.text().trim();

                try {
                    let cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();

                    const objectMatch = cleanJson.match(/\{.*"sections".*\}/s);
                    if (objectMatch) {
                        cleanJson = objectMatch[0];
                    }

                    const parsed = JSON.parse(cleanJson);
                    if (!parsed || !Array.isArray(parsed.sections)) {
                        throw new Error('Root JSON does not contain a "sections" array.');
                    }

                    mediaTitles = parsed.sections.filter(
                        (s: any) => s && typeof s === 'object' && typeof s.title === 'string' && typeof s.action === 'string'
                    );
                    console.log(`[API - Gemini Fallback] Parsed Entities from ${modelId} - Found ${mediaTitles.length} items.`);

                    success = true;
                    break;

                } catch (parseError) {
                    console.error(`[API - Gemini Fallback] ${modelId} returned invalid JSON:`, parseError);
                    throw new Error(`Model ${modelId} returned invalid JSON.`);
                }

            } catch (err: unknown) {
                const typedErr = err as GoogleGenerativeAIError;
                console.warn(`[API - Gemini Fallback] ${modelId} failed:`, typedErr.message);
                lastError = typedErr;

                if (typedErr?.status === 429 || typedErr?.message?.includes('429') || typedErr?.message?.includes('Quota')) {
                    quotaError = typedErr;
                }
            }
        }

        // 8. Graceful Degradation Fallback (Rescue Mode)
        // If all AI models fail (e.g., Google 503 high demand or 429 rate limit across all tiers),
        // fallback gracefully to TMDB direct search so the user still receives search results!
        if (!success) {
            console.warn(`[API - Gemini Fallback] All fallback models failed for query: "${sanitizedQuery}". Activating Graceful Degradation.`);

            const degradedPayload = {
                sections: [
                    {
                        title: `Results for "${sanitizedQuery}"`,
                        action: 'exact_match',
                        parameters: {
                            query: sanitizedQuery
                        }
                    }
                ],
                degraded: true,
                notice: 'AI assistant is currently experiencing high demand. Showing direct matches.'
            };

            res.setHeader('X-Cache-Status', 'DEGRADED');
            return res.status(200).json(degradedPayload);
        }

        const successPayload = { sections: mediaTitles };
        setQueryCache(sanitizedQuery, successPayload);
        res.setHeader('X-Cache-Status', 'MISS');

        return res.status(200).json(successPayload);

    } catch (error: unknown) {
        const typedError = error as GoogleGenerativeAIError;
        console.error('[API - Gemini Fallback] Search Error Trapped:', typedError);

        let retryAfter = 60;
        try {
            const details = typedError?.errorDetails;
            if (Array.isArray(details)) {
                const retryInfo = details.find((d) => d && typeof d === 'object' && 'retryDelay' in d);
                if (retryInfo && typeof retryInfo.retryDelay === 'string') {
                    retryAfter = parseInt(retryInfo.retryDelay.replace('s', ''), 10) || 60;
                }
            }
        } catch (e) { }

        const msg = typedError?.message || '';
        const fallbackMatch = msg.match(/Retry in (\d+)s/i);
        if (fallbackMatch) retryAfter = parseInt(fallbackMatch[1], 10);

        if (typedError?.status === 429 || msg.includes('429') || msg.includes('Quota')) {
            return res.status(429).json({ error: 'AI Quota Exceeded. Please slow down.', retryAfter });
        }

        if (typedError?.status === 503 || msg.includes('503') || msg.includes('high demand') || msg.includes('Service Unavailable')) {
            return res.status(503).json({
                error: 'AI assistant is experiencing high demand. Please try again shortly.',
                retryAfter: 5
            });
        }

        // Return a clean error without exposing upstream details, tokens, or internal tracebacks
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
