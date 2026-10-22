// Suppress Node.js runtime DEP0169 deprecation warnings
process.noDeprecation = true;

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { checkRateLimit } from '../lib/rate-limiter';

const MAX_TEXT_LENGTH = 10000;
// Maximum ~5.5MB base64 payload size (well within Vercel's 4.5MB raw body limit)
const MAX_IMAGE_BASE64_LENGTH = 5.5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
]);

const SYSTEM_EXTRACTION_INSTRUCTION = `
You are an expert movie, TV series, and documentary extraction assistant for CineScope.
Analyze the user-provided text or screenshot image.
Identify all distinct movie or TV show titles referenced.
For each title:
1. Extract the clean official title (without extraneous words, episode numbers, or social media handles).
2. If available or clearly discernible from context, infer the release year (4-digit integer) and media type ('movie' or 'tv').
3. Filter out actor names, director names, studio names, platform names (like Netflix, HBO, Hulu), and UI elements unless they are part of the actual title.

Return ONLY a valid JSON array of objects conforming to this structure:
[
  { "title": "Inception", "year": 2010, "mediaType": "movie" },
  { "title": "The Bear", "year": 2022, "mediaType": "tv" }
]
If no valid titles are found, return [].
`;

export interface ExtractedTitleItem {
    title: string;
    year?: number;
    mediaType?: 'movie' | 'tv';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    // 1. Client Origin Guard
    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. IP Rate Limiting Guard (20 requests / min per IP)
    if (!checkRateLimit(req, res, { windowSec: 60, maxRequests: 20 })) {
        return res;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[API - Extract] Missing GEMINI_API_KEY in environment.');
        return res.status(500).json({ error: 'Internal Server Configuration Error' });
    }

    try {
        const body = (req.body || {}) as {
            text?: unknown;
            image?: unknown;
            mimeType?: unknown;
        };

        const hasText = typeof body.text === 'string' && body.text.trim().length > 0;
        const hasImage = typeof body.image === 'string' && body.image.trim().length > 0;

        if (!hasText && !hasImage) {
            return res.status(400).json({
                error: 'Either "text" or "image" payload is required.'
            });
        }

        const parts: Part[] = [];

        // Validate and attach text payload
        if (hasText) {
            const sanitizedText = (body.text as string).trim();
            if (sanitizedText.length > MAX_TEXT_LENGTH) {
                return res.status(400).json({
                    error: `Text payload exceeds maximum allowed length of ${MAX_TEXT_LENGTH} characters.`
                });
            }
            parts.push({
                text: `Extracted OCR or user text:\n${sanitizedText}`
            });
        }

        // Validate and attach base64 image payload
        if (hasImage) {
            const rawImage = (body.image as string).trim();
            if (rawImage.length > MAX_IMAGE_BASE64_LENGTH) {
                return res.status(400).json({
                    error: 'Image payload exceeds maximum allowed size (~4MB).'
                });
            }

            let mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : 'image/jpeg';
            let base64Data = rawImage;

            // Robust data URL header extraction
            const commaIdx = rawImage.indexOf(',');
            if (rawImage.startsWith('data:') && commaIdx !== -1) {
                const header = rawImage.substring(0, commaIdx);
                const match = header.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64$/i);
                if (match) {
                    mimeType = match[1].toLowerCase().trim();
                }
                base64Data = rawImage.substring(commaIdx + 1);
            }

            // Remove any whitespace, newlines, or carriage returns from base64
            base64Data = base64Data.replace(/[\r\n\s]+/g, '');

            if (!ALLOWED_MIME_TYPES.has(mimeType)) {
                return res.status(400).json({
                    error: `Unsupported image MIME type "${mimeType}". Allowed types: image/jpeg, image/png, image/webp, image/heic.`
                });
            }

            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType
                }
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const candidateModels = [
            process.env.GEMINI_MODEL,
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash-lite',
            'gemini-2.5-flash'
        ].filter((m): m is string => Boolean(m));

        let result: any = null;
        let lastError: unknown = null;

        for (const modelName of candidateModels) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: {
                        role: 'system',
                        parts: [{ text: SYSTEM_EXTRACTION_INSTRUCTION }]
                    },
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.1
                    }
                });

                result = await model.generateContent({
                    contents: [
                        {
                            role: 'user',
                            parts
                        }
                    ]
                });
                break;
            } catch (err: any) {
                lastError = err;
                console.warn(`[API - Extract] Model ${modelName} failed or rate limited:`, err?.message || err);
            }
        }

        if (!result) {
            console.error('[API - Extract Error] All candidate models failed:', lastError);
            const errStr = String((lastError as any)?.message || '');
            const status = (lastError as any)?.status;

            if (errStr.includes('429') || status === 429) {
                return res.status(429).json({
                    error: 'Gemini AI rate limit reached. Please wait a minute before retrying.'
                });
            }

            if (errStr.includes('503') || status === 503) {
                return res.status(503).json({
                    error: 'Gemini AI is currently experiencing high demand. Please try again shortly.'
                });
            }

            return res.status(500).json({
                error: 'Failed to extract titles from AI service. Please try again.'
            });
        }

        const responseText: string = result.response.text().trim();
        let parsed: unknown = [];

        try {
            const cleanJson = responseText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```$/i, '')
                .trim();
            parsed = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error('[API - Extract] JSON parse failure on model response:', responseText);
            return res.status(500).json({ error: 'Failed to parse model response' });
        }

        const items: ExtractedTitleItem[] = (Array.isArray(parsed) ? parsed : [])
            .map((item: any) => {
                if (typeof item === 'string') {
                    const clean = item.trim();
                    return clean.length > 0 ? { title: clean } : null;
                }
                if (item && typeof item === 'object' && typeof item.title === 'string') {
                    const cleanTitle = item.title.trim();
                    if (!cleanTitle) return null;
                    const resItem: ExtractedTitleItem = { title: cleanTitle };
                    if (typeof item.year === 'number' && item.year > 1880 && item.year < 2100) {
                        resItem.year = Math.round(item.year);
                    }
                    if (item.mediaType === 'movie' || item.mediaType === 'tv') {
                        resItem.mediaType = item.mediaType;
                    }
                    return resItem;
                }
                return null;
            })
            .filter((item): item is ExtractedTitleItem => item !== null);

        return res.status(200).json(items);

    } catch (error: unknown) {
        console.error('[API - Extract Error]', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
