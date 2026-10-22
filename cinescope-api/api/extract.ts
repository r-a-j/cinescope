import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '../lib/rate-limiter';

const MAX_TEXT_LENGTH = 10000;

const SYSTEM_EXTRACTION_INSTRUCTION = `
You are a movie and TV series extraction assistant.
Read the user-provided text extracted from images or screenshots.
Identify any valid movie or TV show titles referenced across the text.
Ignore actor names, director names, release years, timestamps, and UI/social media artifacts.
Return ONLY a valid JSON array of strings containing unique titles. Example: ["Inception", "Breaking Bad"].
If you find no recognizable titles, return [].
`;

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
        const body = (req.body || {}) as { text?: unknown };

        // 2. Strict Input Length & Type Validation
        if (!body.text || typeof body.text !== 'string') {
            return res.status(400).json({ error: 'Text payload is required and must be a string.' });
        }

        const sanitizedText = body.text.trim();
        if (sanitizedText.length === 0) {
            return res.status(400).json({ error: 'Text payload cannot be empty.' });
        }

        if (sanitizedText.length > MAX_TEXT_LENGTH) {
            return res.status(400).json({
                error: `Text payload exceeds maximum allowed length of ${MAX_TEXT_LENGTH} characters.`
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: {
                role: 'system',
                parts: [{ text: SYSTEM_EXTRACTION_INSTRUCTION }]
            },
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1
            }
        });

        // 3. Isolated User Message Turn
        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `OCR Text Content:\n${sanitizedText}` }]
                }
            ]
        });

        const responseText: string = result.response.text().trim();
        let parsed: unknown = [];

        try {
            parsed = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[API - Extract] JSON parse failure on model response:', responseText);
            return res.status(500).json({ error: 'Failed to parse model response' });
        }

        const titles = (Array.isArray(parsed) ? parsed : [])
            .map((item: any) => typeof item === 'string' ? item : (item && typeof item === 'object' && typeof item.title === 'string' ? item.title : ''))
            .filter((t: string) => typeof t === 'string' && t.trim().length > 0);

        return res.status(200).json(titles);

    } catch (error: unknown) {
        console.error('[API - Extract Error]', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
