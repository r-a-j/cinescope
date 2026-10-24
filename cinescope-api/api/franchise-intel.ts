// Suppress Node.js runtime DEP0169 deprecation warnings
process.noDeprecation = true;

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '../lib/rate-limiter';
import { getQueryCache, setQueryCache } from '../lib/query-cache';

const ALLOWED_GEMINI_MODELS = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
];

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
4. "canonTitles": 15-30 authoritative canon titles (movies and television shows) that form the master saga. For each title provide:
   - "title": Clean official title (e.g. "Iron Man", "The Avengers", "Loki", "Agatha All Along")
   - "year": 4-digit release year integer
   - "media_type": 'movie' or 'tv'
   - "importance": 'essential' | 'recommended' | 'optional'
5. "siblingFranchises": Connected sub-collections or sagas within the universe.
6. "recommendedWatchOrder": Array of titles in canonical release or story order.

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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Only POST is accepted.' });
    }

    // Rate limiting check
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
        return res.status(429).json({
            error: 'Rate limit exceeded. Please wait before analyzing another franchise.',
            retryAfter: rateLimit.retryAfter
        });
    }

    const { collectionId, collectionName, parts } = req.body || {};
    if (!collectionId || !collectionName) {
        return res.status(400).json({ error: 'Missing required fields: collectionId and collectionName.' });
    }

    const cacheKey = `franchise_intel_${collectionId}`;
    const cached = getQueryCache(cacheKey);
    if (cached) {
        return res.status(200).json(cached);
    }

    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
        return res.status(500).json({ error: 'Server misconfigured. GEMINI_API_KEY is missing.' });
    }

    const prompt = `Analyze this collection:
Collection TMDB ID: ${collectionId}
Collection Name: "${collectionName}"
Parts: ${Array.isArray(parts) ? parts.map((p: { title?: string; release_date?: string }) => `${p.title || 'Unknown'} (${p.release_date?.slice(0, 4) || 'N/A'})`).join(', ') : 'Not provided'}
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: Error | null = null;

    for (const modelName of ALLOWED_GEMINI_MODELS) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: SYSTEM_FRANCHISE_INTEL_INSTRUCTION,
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.2
                }
            });

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            if (!text) continue;

            const parsed = JSON.parse(text);
            setQueryCache(cacheKey, parsed);
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
