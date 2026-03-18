import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const path = req.headers['x-tmdb-path'];

        if (!path || typeof path !== 'string') {
            return res.status(400).json({ error: 'X-TMDB-Path header is missing' });
        }

        const tmdbBaseUrl = 'https://api.themoviedb.org/3';
        const url = new URL(`${tmdbBaseUrl}${path}`);

        // Safely append query parameters sent from the mobile app
        for (const [key, value] of Object.entries(req.query)) {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        }

        const tmdbResponse = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`
            }
        });

        const data: unknown = await tmdbResponse.json();
        return res.status(tmdbResponse.status).json(data);

    } catch (error: unknown) {
        console.error('[TMDB Proxy Error]', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}