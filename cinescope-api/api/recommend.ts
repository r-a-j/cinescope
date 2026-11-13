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

const DEFAULT_FALLBACK_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
];

const MAX_FALLBACK_MODELS = 4;

export interface TasteSeedInput {
    title: string;
    year?: string;
    mediaType: 'movie' | 'tv';
    genres?: string[];
    language?: string;
    weight?: number;
}

export interface RecommendRequestBody {
    mode?: 'for-you' | 'tonight' | 'blend';
    topSeeds?: TasteSeedInput[];
    watchlistSeeds?: TasteSeedInput[];
    stalledTitles?: string[];
    favoritePeople?: string[];
    preferredLanguages?: string[];
    topGenrePairs?: string[];
    archetypes?: string[];
    preferredRuntimeMin?: number;
    excludeTitles?: string[];
    moodPrompt?: string;
    models?: string[];
}

export interface AiCuratedPickDto {
    title: string;
    year?: number;
    mediaType: 'movie' | 'tv';
    reason: string;
}

export interface AiDiscoverGraphDto {
    with_genres?: string;
    without_genres?: string;
    keywords?: string[];
    with_original_language?: string;
    person_name?: string;
    vote_average_gte?: number;
    vote_count_gte?: number;
    release_year_gte?: number;
    release_year_lte?: number;
    runtime_lte?: number;
    sort_by?: 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc';
}

export interface AiRecommendationLaneDto {
    id: string;
    title: string;
    subtitle: string;
    mediaType: 'movie' | 'tv';
    curatedPicks: AiCuratedPickDto[];
    discoverGraph: AiDiscoverGraphDto;
}

const SYSTEM_RECOMMEND_ORCHESTRATOR_INSTRUCTION = `
You are CinePulse AI, a state-of-the-art hybrid cinema & TV recommendation engine for CineScope.
You receive a user's structured Taste DNA Profile (their top watched/completed movies & series, watchlist intent, favorite directors/actors, preferred languages, top genre combinations, and stalled/disliked signals).

Your mission: Synthesize 4 distinct, deeply personalized recommendation lanes (mix of 'movie' and 'tv' lanes) that go far beyond generic blockbusters.
Use deep film-theory connections: narrative pacing, directorial tone, psychological tropes, cultural movements, and thematic intersections.

CRITICAL RULES:
1. NEVER recommend any title listed in "excludeTitles", "topSeeds", or "watchlistSeeds". All recommended titles must already be officially released to public audiences (never suggest unreleased, announced, or in-production projects).
2. Respect the user's "preferredLanguages" (ISO 639-1 codes like 'hi', 'en', 'ko', 'ml', 'ta', 'ja', 'es'). Ensure lanes reflect their linguistic palate.
3. For each lane, return BOTH:
   - "curatedPicks": 5 to 6 real, existing movies or TV shows that match the lane's micro-theme, with release year and a sharp 1-line "reason" (< 75 chars) explaining WHY it fits their specific seeds.
   - "discoverGraph": A companion TMDB Discover filter graph so the frontend can infinitely paginate the lane.
     - Use comma "," in "with_genres" for strict AND intersections (e.g. "878,53" for Sci-Fi AND Thriller) or pipe "|" for OR.
     - TMDB Movie Genre IDs: Action=28, Adventure=12, Animation=16, Comedy=35, Crime=80, Documentary=99, Drama=18, Family=10751, Fantasy=14, History=36, Horror=27, Music=10402, Mystery=9648, Romance=10749, Sci-Fi=878, Thriller=53, War=10752, Western=37.
     - TMDB TV Genre IDs: Action/Adventure=10759, Animation=16, Comedy=35, Crime=80, Documentary=99, Drama=18, Family=10751, Mystery=9648, Sci-Fi/Fantasy=10765, War/Politics=10768.
4. Return ONLY valid raw JSON matching this exact schema (no markdown code fences):
{
  "lanes": [
    {
      "id": "string-slug",
      "title": "Short, punchy 2-3 word theme in UPPERCASE under 18 characters without 'AI' or 'Pulse' prefix (e.g. NEO NOIR, TECH THRILLERS, CRIME SAGAS, DARK COMEDY)",
      "subtitle": "Because you loved [Seed A] & [Seed B]",
      "mediaType": "movie" | "tv",
      "curatedPicks": [
        { "title": "Exact Movie/Show Title", "year": 2022, "mediaType": "movie", "reason": "Shares the tense time-loop paranoia of Dark" }
      ],
      "discoverGraph": {
        "with_genres": "878,53",
        "without_genres": "10751",
        "keywords": ["time loop", "dystopia"],
        "with_original_language": "en|ko",
        "vote_average_gte": 7.2,
        "vote_count_gte": 100,
        "sort_by": "vote_average.desc"
      }
    }
  ]
}
`;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!checkRateLimit(req, res, { windowSec: 60, maxRequests: 20 })) {
        return res;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Internal Server Configuration Error' });
    }

    try {
        const body = (req.body || {}) as RecommendRequestBody;

        const compactProfile = {
            mode: body.mode || 'for-you',
            topSeeds: (body.topSeeds || []).slice(0, 14),
            watchlistSeeds: (body.watchlistSeeds || []).slice(0, 6),
            stalledTitles: (body.stalledTitles || []).slice(0, 5),
            favoritePeople: (body.favoritePeople || []).slice(0, 8),
            preferredLanguages: (body.preferredLanguages || ['hi', 'en']).slice(0, 6),
            topGenrePairs: (body.topGenrePairs || []).slice(0, 6),
            archetypes: (body.archetypes || []).slice(0, 4),
            preferredRuntimeMin: body.preferredRuntimeMin,
            excludeTitles: (body.excludeTitles || []).slice(0, 35),
            moodPrompt: typeof body.moodPrompt === 'string' ? body.moodPrompt.slice(0, 200) : undefined
        };

        const cacheKey = `rec_v2_${JSON.stringify({
            m: compactProfile.mode,
            s: compactProfile.topSeeds.map((x) => x.title).slice(0, 8),
            l: compactProfile.preferredLanguages,
            g: compactProfile.topGenrePairs.slice(0, 3),
            p: compactProfile.moodPrompt
        })}`;

        const cachedPayload = getQueryCache<{ lanes: AiRecommendationLaneDto[] }>(cacheKey);
        if (cachedPayload) {
            res.setHeader('X-Cache-Status', 'HIT');
            return res.status(200).json(cachedPayload);
        }

        let candidateModels: string[] = [];
        if (Array.isArray(body.models)) {
            candidateModels = body.models
                .filter((m): m is string => typeof m === 'string' && ALLOWED_GEMINI_MODELS.has(m))
                .slice(0, MAX_FALLBACK_MODELS);
        }

        const modelsToAttempt = Array.from(new Set([...candidateModels, ...DEFAULT_FALLBACK_CASCADE])).slice(
            0,
            MAX_FALLBACK_MODELS
        );

        const genAI = new GoogleGenerativeAI(apiKey);
        let lanes: AiRecommendationLaneDto[] = [];
        let success = false;

        for (const modelId of modelsToAttempt) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelId,
                    systemInstruction: {
                        role: 'system',
                        parts: [{ text: SYSTEM_RECOMMEND_ORCHESTRATOR_INSTRUCTION }]
                    },
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.35
                    }
                });

                const result = await model.generateContent({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: `User Taste DNA Profile:\n${JSON.stringify(compactProfile)}` }]
                        }
                    ]
                });

                let cleanJson = result.response
                    .text()
                    .replace(/```json/gi, '')
                    .replace(/```/gi, '')
                    .trim();

                const objectMatch = cleanJson.match(/\{.*"lanes".*\}/s);
                if (objectMatch) {
                    cleanJson = objectMatch[0];
                }

                const parsed = JSON.parse(cleanJson) as { lanes?: AiRecommendationLaneDto[] };
                if (!parsed || !Array.isArray(parsed.lanes) || parsed.lanes.length === 0) {
                    throw new Error('Invalid lanes array in Gemini response');
                }

                lanes = parsed.lanes
                    .filter((l) => l && typeof l.title === 'string' && (l.mediaType === 'movie' || l.mediaType === 'tv'))
                    .slice(0, 5)
                    .map((l, idx) => ({
                        id: l.id || `ai-pulse-${idx}`,
                        title: l.title.trim().toUpperCase(),
                        subtitle: (l.subtitle || 'Curated for your Taste DNA').trim(),
                        mediaType: l.mediaType,
                        curatedPicks: Array.isArray(l.curatedPicks)
                            ? l.curatedPicks
                                  .filter((p) => p && typeof p.title === 'string')
                                  .slice(0, 6)
                                  .map((p) => ({
                                      title: p.title.trim(),
                                      year: typeof p.year === 'number' ? p.year : undefined,
                                      mediaType: p.mediaType === 'tv' ? 'tv' : 'movie',
                                      reason: typeof p.reason === 'string' ? p.reason.trim().slice(0, 90) : 'Matches your Taste DNA'
                                  }))
                            : [],
                        discoverGraph: l.discoverGraph || {}
                    }));

                if (lanes.length > 0) {
                    success = true;
                    break;
                }
            } catch (err: unknown) {
                const typedErr = err as GoogleGenerativeAIError;
                console.warn(`[API - Recommend] ${modelId} failed:`, typedErr.message);
            }
        }

        if (!success) {
            const langPipe = compactProfile.preferredLanguages.join('|') || 'hi|en';
            const fallbackLanes: AiRecommendationLaneDto[] = [
                {
                    id: 'fallback-mindbenders',
                    title: 'SCI-FI THRILLERS',
                    subtitle: 'Fallback taste profile curation',
                    mediaType: 'movie',
                    curatedPicks: [],
                    discoverGraph: {
                        with_genres: '878,53',
                        with_original_language: langPipe,
                        vote_average_gte: 7.2,
                        vote_count_gte: 80,
                        sort_by: 'vote_average.desc'
                    }
                },
                {
                    id: 'fallback-prestige-tv',
                    title: 'CRIME & MYSTERY',
                    subtitle: 'Fallback series curation',
                    mediaType: 'tv',
                    curatedPicks: [],
                    discoverGraph: {
                        with_genres: '80|9648',
                        with_original_language: langPipe,
                        vote_average_gte: 7.4,
                        vote_count_gte: 50,
                        sort_by: 'vote_average.desc'
                    }
                }
            ];
            res.setHeader('X-Cache-Status', 'DEGRADED');
            return res.status(200).json({ lanes: fallbackLanes, degraded: true });
        }

        const responsePayload = { lanes };
        setQueryCache(cacheKey, responsePayload);
        res.setHeader('X-Cache-Status', 'MISS');
        return res.status(200).json(responsePayload);
    } catch (error: unknown) {
        console.error('[API - Recommend] Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
