import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GoogleRpcRetryInfo {
    retryDelay?: string;
    [key: string]: unknown;
}

export interface GoogleGenerativeAIError extends Error {
    status?: number;
    errorDetails?: GoogleRpcRetryInfo[];
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    // 1. Handle CORS Preflight perfectly
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');
        return res.status(200).end();
    }

    // Apply standard CORS headers to actual payload
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 2. Strict Application Guard
    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { query, models = ['gemini-3.1-flash-lite-preview'] } = req.body as { query?: string, models?: string[] };

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const prompt = `
            You are an elite, highly intelligent cinematic search engine orchestrator for the International Movie Database (TMDB).
            Analyze the user's semantic search query carefully.

            Your task is NOT to return a hardcoded list of movies. Instead, deduce the user's ultimate goal and return an **Execution Graph** of API calls that my frontend engine will execute against TMDB's Discover endpoints to provide massive, exhaustively scrollable lists.
            
            You must return ONLY a raw, valid JSON array of section objects. DO NOT wrap the output in markdown blocks.

            CRITICAL JSON SCHEMA TO FOLLOW FOR EACH OBJECT:
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

            If the query is nonsensical, return {"sections": []}.
            User Query: "${query}"
        `;

        let success = false;
        let mediaTitles: unknown[] = [];
        let lastError: unknown = null;
        let quotaError: unknown = null;

        console.log(`[API - Gemini Fallback] Starting Cascading Fallback Loop for query: "${query}"`);

        // 3. Fallback Model Engine
        for (const modelId of models) {
            try {
                console.log(`[API - Gemini Fallback] Attempting Model: ${modelId}`);

                const model = genAI.getGenerativeModel({
                    model: modelId,
                    generationConfig: { responseMimeType: 'application/json' }
                });

                const result = await model.generateContent(prompt);
                const responseText: string = result.response.text().trim();

                try {
                    let cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();

                    // Match an object containing the sections array to avoid trailing markdown
                    const objectMatch = cleanJson.match(/\{.*"sections".*\}/s);
                    if (objectMatch) {
                        cleanJson = objectMatch[0];
                    }

                    const parsed = JSON.parse(cleanJson);
                    if (!parsed || !Array.isArray(parsed.sections)) throw new Error('Root JSON does not contain a "sections" array.');
                    mediaTitles = parsed.sections;
                    console.log(`[API - Gemini Fallback] Parsed Entities from ${modelId} - Found ${mediaTitles.length} items.`);
                    console.log('-------response check-------', result.response.text());

                    success = true;
                    break;

                } catch (parseError) {
                    console.error(`[API - Gemini Fallback] ${modelId} Hallucinated Invalid JSON. Raw Text:`, responseText);
                    throw new Error(`Model ${modelId} hallucinated invalid JSON.`);
                }

            } catch (err: unknown) {
                const typedErr = err as GoogleGenerativeAIError;
                console.warn(`[API - Gemini Fallback] ${modelId} failed. Reason:`, typedErr.message);
                lastError = typedErr;

                // If it's a structural API error for Quota, prioritize it!
                if (typedErr?.status === 429 || typedErr?.message?.includes('429') || typedErr?.message?.includes('Quota')) {
                    quotaError = typedErr;
                }
            }
        }

        if (!success) {
            console.error('[API - Gemini Fallback] ALL fallback models were completely exhausted!');
            // Prioritize returning the Quota error if we got one, otherwise the last error (like 404 Not Found)
            throw quotaError || lastError || new Error('All models exhausted without success.');
        }

        return res.status(200).json({ sections: mediaTitles });

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

        // Add the actual error message to the 500 response so we can debug it immediately!
        return res.status(500).json({ error: 'Internal Server Error', details: msg });
    }
}
