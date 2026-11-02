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

const DEFAULT_FALLBACK_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
];

const MAX_FALLBACK_MODELS = 4;
const SERVER_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours server-side cache

export interface TvReleaseIntelItemDto {
    tmdbId: number;
    seriesTitle: string;
    seasonNumber: number;
    releaseStatus: 'confirmed' | 'planned' | 'in_production' | 'tba' | 'ended_or_canceled';
    releaseDate: string | null;
    releaseYear: number | null;
    releaseWindow: string;
    confidence: 'high' | 'medium' | 'low';
    notes: string;
}

export interface TvReleaseIntelResponseDto {
    results: TvReleaseIntelItemDto[];
    cachedAt?: number;
}

const SYSTEM_TV_RELEASE_INTEL_INSTRUCTION = `
You are an authoritative television industry researcher and premiere date verifier for CineScope.
Your task is to verify and deduce the latest, most authentic premiere release dates, planned release years, and release windows for upcoming TV series seasons.

Analyze the user's requested TV series and season numbers carefully using the latest industry announcements, official platform press releases (Netflix, Prime Video, Apple TV+, Sony LIV, Disney+, HBO/Max, Hulu, Paramount+, etc.), showrunner statements, and production statuses.

For each series, identify:
1. "tmdbId": The integer TMDB ID passed in the query.
2. "seriesTitle": Clean title of the series.
3. "seasonNumber": The season number in question (e.g. 2 for Season 2).
4. "releaseStatus":
   - "confirmed": An exact premiere date has been officially announced (e.g., "2026-11-20").
   - "planned": A specific year, quarter, or seasonal window is officially announced or planned (e.g., "Planned 2026", "Late 2026", "Spring 2027").
   - "in_production": Actively filming or in post-production without a confirmed window.
   - "tba": Officially renewed or in development with no date or target window announced yet.
   - "ended_or_canceled": The series has ended or was cancelled by the studio/network.
5. "releaseDate": Full "YYYY-MM-DD" string IF AND ONLY IF an exact confirmed or officially reported premiere date is known. If only a year or month is known, return null.
6. "releaseYear": 4-digit integer (e.g. 2026, 2027) for the planned premiere year if known. Otherwise null.
7. "releaseWindow": Clean, compact human-readable window label (e.g. "Nov 2026", "Late 2026", "Spring 2027", "2026", "2027", "TBA").
8. "confidence": "high" | "medium" | "low".
9. "notes": 1 brief sentence citing the platform or production status (e.g. "Officially announced by Prime Video for late 2026").

CRITICAL FORMATTING INSTRUCTIONS:
- You must return ONLY a raw, valid JSON object with a "results" array.
- Do NOT wrap output in markdown code fences or backticks.
- If a series is completely unknown, return status "tba" with releaseDate null and releaseYear null.

JSON SCHEMA:
{
  "results": [
    {
      "tmdbId": 555,
      "seriesTitle": "Matka King",
      "seasonNumber": 2,
      "releaseStatus": "planned",
      "releaseDate": null,
      "releaseYear": 2026,
      "releaseWindow": "Late 2026",
      "confidence": "medium",
      "notes": "Season 2 announced by Prime Video with production targeted for late 2026 release."
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');

    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Only POST is accepted.' });
    }

    if (!checkRateLimit(req, res, { windowSec: 60, maxRequests: 20 })) {
        return res;
    }

    const { series, models } = req.body || {};
    if (!Array.isArray(series) || series.length === 0) {
        return res.status(400).json({ error: 'Missing required field: series (array of series objects).' });
    }

    // Limit batch to max 15 series per request to protect tokens and latency
    const sanitizedSeries = series.slice(0, 15).map((s: { tmdbId?: number; title?: string; seasonNumber?: number; currentAirDate?: string | null }) => ({
        tmdbId: Number(s.tmdbId) || 0,
        title: String(s.title || '').trim().slice(0, 150),
        seasonNumber: Number(s.seasonNumber) || 1,
        currentAirDate: s.currentAirDate ? String(s.currentAirDate).slice(0, 30) : null
    })).filter((s) => s.tmdbId > 0 && s.title.length > 0);

    if (sanitizedSeries.length === 0) {
        return res.status(400).json({ error: 'No valid series provided in request.' });
    }

    // Check query cache
    const cacheKey = `tv_release_intel_${sanitizedSeries.map((s) => `${s.tmdbId}_s${s.seasonNumber}`).sort().join('_')}`;
    const cached = getQueryCache(cacheKey) as TvReleaseIntelResponseDto | undefined;
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

    const seriesQueryLines = sanitizedSeries.map(
        (s) => `- TMDB ID ${s.tmdbId}: "${s.title}" (Target: Season ${s.seasonNumber}, Current TMDB Date: ${s.currentAirDate || 'None/TBA'})`
    ).join('\n');

    const prompt = `Verify authentic premiere dates and planned release windows for these upcoming TV seasons:\n${seriesQueryLines}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: Error | null = null;

    for (const modelName of modelsToAttempt) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: SYSTEM_TV_RELEASE_INTEL_INSTRUCTION }]
                },
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                    maxOutputTokens: 4096
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

            const parsed = JSON.parse(cleanJson) as TvReleaseIntelResponseDto;
            parsed.cachedAt = Date.now();
            setQueryCache(cacheKey, parsed, SERVER_CACHE_TTL_MS);

            res.setHeader('X-Cache-Status', 'MISS');
            return res.status(200).json(parsed);
        } catch (err) {
            lastError = err as Error;
            console.warn(`[tv-release-intel] Model ${modelName} failed:`, err);
        }
    }

    const errStr = String(lastError?.message || '');
    if (errStr.includes('429') || (lastError as { status?: number })?.status === 429) {
        return res.status(429).json({ error: 'AI Quota Exceeded. Please try again shortly.' });
    }

    console.error('[API tv-release-intel Error] All models failed:', lastError);
    return res.status(500).json({ error: 'Failed to verify TV release intelligence.' });
}
