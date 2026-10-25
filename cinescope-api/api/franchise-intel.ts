// Suppress Node.js runtime DEP0169 deprecation warnings
process.noDeprecation = true;

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '../lib/rate-limiter';
import { getQueryCache, setQueryCache } from '../lib/query-cache';

const ALLOWED_GEMINI_MODELS = new Set([
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
    'gemini-3.8-flash'
]);

/**
 * Server-side fallback chain prioritized by highest RPD quota capacity (500 RPD each on 3.5 & 3.1 Flash Lite)
 */
const DEFAULT_FALLBACK_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
];

const MAX_FALLBACK_MODELS = 4;
const FRANCHISE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours server-side cache

const SYSTEM_FRANCHISE_INTEL_INSTRUCTION = `
You are an authoritative cinematic universe researcher and archivist for CineScope.
Your task is to analyze a given movie collection and reason whether it is a pillar or sub-collection of a larger, overarching shared cinematic universe or cross-media canon franchise.

Examples of Shared Universes:
- "Captain America Collection" -> Part of "Marvel Cinematic Universe (MCU)" (universeId: "mcu")
- "Iron Man Collection" -> Part of "Marvel Cinematic Universe (MCU)" (universeId: "mcu")
- "Thor Collection" -> Part of "Marvel Cinematic Universe (MCU)" (universeId: "mcu")
- "Star Wars Original Trilogy" -> Part of "Star Wars Universe" (universeId: "star_wars")
- "The Dark Knight Trilogy" -> Self-contained trilogy (isSharedUniverse: false)
- "John Wick Collection" -> Part of "John Wick Universe" (includes The Continental, Ballerina)
- "Dhoom Collection" -> Direct movie series (isSharedUniverse: false)
- "Harry Potter Collection" -> Part of "Wizarding World" (universeId: "wizarding_world", includes Fantastic Beasts)

If the collection is part of a larger shared universe, identify:
1. "universeTitle": Clean, authoritative name of the overarching universe (e.g. "Marvel Cinematic Universe (MCU)", "Wizarding World", "Star Wars Universe").
2. "universeId": URL-safe identifier (e.g. "mcu", "wizarding_world", "star_wars").
3. "connectionInsight": 2-3 clear sentences explaining how the input collection links into the overarching master saga.
4. "canonTitles": Return the COMPLETE, EXHAUSTIVE list of ABSOLUTELY ALL official canon Movies AND TV Series (live-action series, canon animated series, and specials) in the entire franchise/universe — from the very first entry up through 2024, 2025, 2026, and officially announced upcoming releases (e.g. for MCU, include every Phase 1–6 theatrical film and every Marvel Studios Disney+ / television series including WandaVision, Loki, What If...?, Hawkeye, Moon Knight, Ms. Marvel, She-Hulk, Secret Invasion, Echo, X-Men '97, Agatha All Along, Your Friendly Neighborhood Spider-Man, Daredevil: Born Again, Ironheart, Eyes of Wakanda, Marvel Zombies, Wonder Man, VisionQuest, Deadpool & Wolverine, Captain America: Brave New World, Thunderbolts*, The Fantastic Four: First Steps, Spider-Man: Brand New Day, Avengers: Doomsday, Avengers: Secret Wars, etc.). NEVER truncate or cap the list at 30 items! For each title provide:
   - "title": Clean official title (e.g. "Iron Man", "The Avengers", "Loki", "Agatha All Along", "VisionQuest")
   - "year": 4-digit release year integer
   - "media_type": 'movie' or 'tv'
   - "importance": 'essential' | 'recommended' | 'optional'
5. "siblingFranchises": ONLY official theatrical TMDB movie collections within the universe (e.g. "Iron Man Collection", "Captain America Collection", "Thor Collection", "The Avengers Collection", "Guardians of the Galaxy Collection", "Spider-Man (Avengers) Collection"). NEVER include TV show groupings (such as "Disney+ Canon Series") or conceptual umbrella labels that are not official TMDB movie collections.
6. "recommendedWatchOrder": Array of titles in canonical release or story order.

CRITICAL CANON & AUTHENTICITY GUARD:
- Every title in "canonTitles" MUST be an official, studio-authorized production by the owning studio (e.g. Lionsgate for John Wick, Marvel Studios for MCU, Lucasfilm for Star Wars, Warner Bros / DC for DC Universe).
- STRICTLY EXCLUDE:
  * Fan films, amateur productions, YouTube shorts, student films, parodies, tributes, or bootlegs (e.g. "John Twink", "Physical Touch", "Guns and Strawberries", fan trailers).
  * Documentaries, making-of specials, and retrospective interviews.
  * Unrelated movies that merely share an actor or crowdsourced TMDB keyword.

If the collection is strictly a standalone movie series or trilogy (e.g. Back to the Future, Before Trilogy, The Godfather), set "isSharedUniverse": false.

Return ONLY a valid JSON object matching this schema. Do not wrap in markdown code blocks:
{
  "isSharedUniverse": boolean,
  "universeTitle": "String or null",
  "universeId": "String or null",
  "connectionInsight": "String or null",
  "canonTitles": [
    {
      "title": "String",
      "year": 2008,
      "media_type": "movie",
      "importance": "essential"
    }
  ],
  "siblingFranchises": [
    { "id": 86311, "name": "The Avengers Collection" }
  ],
  "recommendedWatchOrder": [
    "Iron Man",
    "The Incredible Hulk"
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');

    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Only POST is accepted.' });
    }

    // Sliding-window IP rate limit (15 requests / min per IP)
    if (!checkRateLimit(req, res, { windowSec: 60, maxRequests: 15 })) {
        return res;
    }

    const { collectionId, collectionName, franchiseName, parts, knownTitles, models } = req.body || {};
    const finalCollectionName = String(collectionName || franchiseName || '').trim().slice(0, 200);
    if (!finalCollectionName) {
        return res.status(400).json({ error: 'Missing required field: collectionName or franchiseName.' });
    }
    const finalCollectionId = collectionId || `intel_${finalCollectionName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

    const cacheKey = `franchise_intel_v2_${finalCollectionId}`;
    const nameCacheKey = `franchise_intel_v2_name_${finalCollectionName.toLowerCase()}`;
    const cached = getQueryCache(cacheKey) || getQueryCache(nameCacheKey);
    if (cached) {
        res.setHeader('X-Cache-Status', 'HIT');
        return res.status(200).json(cached);
    }

    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
        return res.status(500).json({ error: 'Server misconfigured. GEMINI_API_KEY is missing.' });
    }

    let candidateModels: string[] = [];
    if (Array.isArray(models)) {
        candidateModels = models
            .filter((m): m is string => typeof m === 'string' && ALLOWED_GEMINI_MODELS.has(m))
            .slice(0, MAX_FALLBACK_MODELS);
    }
    const modelsToAttempt = Array.from(new Set([...candidateModels, ...DEFAULT_FALLBACK_CASCADE])).slice(0, MAX_FALLBACK_MODELS);

    const titlesList = Array.isArray(parts)
        ? parts.slice(0, 40).map((p: { title?: string; release_date?: string }) => `${p.title || 'Unknown'} (${p.release_date?.slice(0, 4) || 'N/A'})`).join(', ')
        : (Array.isArray(knownTitles) ? knownTitles.slice(0, 40).join(', ') : 'Not provided');

    const prompt = `Analyze this collection:
Collection TMDB ID: ${finalCollectionId}
Collection Name: "${finalCollectionName}"
Parts: ${titlesList}
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: Error | null = null;

    for (const modelName of modelsToAttempt) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: SYSTEM_FRANCHISE_INTEL_INSTRUCTION }]
                },
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.2,
                    maxOutputTokens: 8192
                }
            });

            const result = await model.generateContent({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ]
            });

            const rawText = result.response.text()?.trim();
            if (!rawText) continue;

            let cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanJson = jsonMatch[0];
            }

            const parsed = JSON.parse(cleanJson);
            setQueryCache(cacheKey, parsed, FRANCHISE_CACHE_TTL_MS);
            setQueryCache(nameCacheKey, parsed, FRANCHISE_CACHE_TTL_MS);

            // Also cross-index sibling franchise IDs in server memory cache so related sagas hit cache in 0ms
            if (Array.isArray(parsed?.siblingFranchises)) {
                for (const sib of parsed.siblingFranchises) {
                    if (sib && typeof sib.id === 'number' && sib.id > 0) {
                        setQueryCache(`franchise_intel_v2_${sib.id}`, parsed, FRANCHISE_CACHE_TTL_MS);
                    }
                    if (sib && typeof sib.name === 'string' && sib.name.trim()) {
                        setQueryCache(`franchise_intel_v2_name_${sib.name.trim().toLowerCase()}`, parsed, FRANCHISE_CACHE_TTL_MS);
                    }
                }
            }

            res.setHeader('X-Cache-Status', 'MISS');
            return res.status(200).json(parsed);
        } catch (err) {
            lastError = err as Error;
            console.warn(`[franchise-intel] Model ${modelName} failed:`, err);
        }
    }

    return res.status(500).json({
        error: 'Failed to reason franchise universe intelligence.',
        details: lastError?.message || 'Unknown error'
    });
}
