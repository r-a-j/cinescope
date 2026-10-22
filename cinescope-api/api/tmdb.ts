// Suppress Node.js runtime DEP0169 url.parse deprecation warnings triggered by internal serverless wrappers
process.noDeprecation = true;

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../lib/rate-limiter';

/**
 * Whitelist of allowed TMDB endpoint prefixes permitted through the CineScope reverse proxy.
 * Any path attempting to touch administrative, account, authentication, or mutation
 * endpoints is strictly rejected.
 */
const ALLOWED_PATH_PREFIXES = [
    '/certification/',
    '/collection/',
    '/company/',
    '/configuration',
    '/credit/',
    '/discover/',
    '/find/',
    '/genre/',
    '/keyword/',
    '/movie/',
    '/network/',
    '/person/',
    '/review/',
    '/search/',
    '/trending/',
    '/tv/',
    '/watch/providers/'
] as const;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TMDB-Path, X-Cinescope-Client');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    // 1. Client header verification
    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    // 2. Only read-only GET requests are permitted
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed. Only GET is permitted.' });
    }

    // 3. IP Rate Limiting Guard (120 requests / min per IP)
    if (!checkRateLimit(req, res, { windowSec: 60, maxRequests: 120 })) {
        return res;
    }

    // 3. Verify server environment configuration
    const token = process.env.TMDB_ACCESS_TOKEN;
    if (!token) {
        console.error('[TMDB Proxy Error] Missing TMDB_ACCESS_TOKEN in server environment.');
        return res.status(500).json({ error: 'Internal Server Configuration Error' });
    }

    try {
        const rawPath = req.headers['x-tmdb-path'];

        if (!rawPath || typeof rawPath !== 'string') {
            return res.status(400).json({ error: 'X-TMDB-Path header is required.' });
        }

        // Sanitize and normalize path
        let normalizedPath = rawPath.trim();
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = `/${normalizedPath}`;
        }

        // Reject path traversal attacks (e.g. /../, /%2e%2e/)
        const lowerPath = normalizedPath.toLowerCase();
        if (
            lowerPath.includes('..') ||
            lowerPath.includes('%2e') ||
            lowerPath.includes('//')
        ) {
            return res.status(400).json({ error: 'Invalid path: traversal sequences are prohibited.' });
        }

        // 4. Strict endpoint prefix allowlist check
        const isAllowed = ALLOWED_PATH_PREFIXES.some(prefix =>
            normalizedPath === prefix || normalizedPath.startsWith(prefix)
        );

        if (!isAllowed) {
            return res.status(403).json({ error: 'Forbidden. Requested TMDB endpoint is not permitted.' });
        }

        // 5. Build and validate target URL
        const targetUrl = new URL(`/3${normalizedPath}`, 'https://api.themoviedb.org');
        if (targetUrl.origin !== 'https://api.themoviedb.org' || !targetUrl.pathname.startsWith('/3/')) {
            return res.status(400).json({ error: 'Invalid destination URL.' });
        }

        // 6. Safely append sanitized query parameters
        for (const [key, value] of Object.entries(req.query)) {
            if (value !== undefined && value !== null && key.length <= 64) {
                if (Array.isArray(value)) {
                    for (const v of value) {
                        targetUrl.searchParams.append(key, String(v).slice(0, 512));
                    }
                } else {
                    targetUrl.searchParams.append(key, String(value).slice(0, 512));
                }
            }
        }

        // 7. Forward request with timeout signal
        const tmdbResponse = await fetch(targetUrl.toString(), {
            method: 'GET',
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${token}`
            },
            signal: AbortSignal.timeout(12000)
        });

        const contentType = tmdbResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data: unknown = await tmdbResponse.json();
            return res.status(tmdbResponse.status).json(data);
        }

        const text = await tmdbResponse.text();
        return res.status(tmdbResponse.status).send(text);

    } catch (error: unknown) {
        console.error('[TMDB Proxy Error]', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
