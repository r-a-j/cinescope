import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    // 1. Client Origin Guard
    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[API - List Models] Missing GEMINI_API_KEY in environment.');
        return res.status(500).json({ error: 'Internal Server Configuration Error' });
    }

    try {
        // 2. Transmit API key via x-goog-api-key header instead of URL query parameter
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
            method: 'GET',
            headers: {
                'x-goog-api-key': apiKey,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
            console.error('[API - List Models] Upstream returned status:', response.status);
            return res.status(response.status).json({ error: 'Failed to fetch model catalog' });
        }

        const data = await response.json() as { models?: Array<{ name?: string; displayName?: string }> };

        let models: Array<{ name: string; displayName: string }> = [];
        if (data && Array.isArray(data.models)) {
            models = data.models
                .filter(m => m && typeof m.name === 'string')
                .map(m => ({
                    name: m.name as string,
                    displayName: m.displayName || m.name as string
                }));
        }

        return res.status(200).json({ models });

    } catch (error: unknown) {
        console.error('[API - List Models Error]', error);
        // 3. Never echo error.message which may contain internal URLs or credentials
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
