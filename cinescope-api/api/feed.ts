import type { VercelRequest, VercelResponse } from '@vercel/node';
import Parser = require('rss-parser');
import { checkRateLimit } from '../lib/rate-limiter';

// Extend the parser's items to grab specific tags like media:content
const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['content:encoded', 'contentEncoded'],
            ['description', 'description']
        ],
    }
});

const DEFAULT_SOURCES = [
    'https://www.slashfilm.com/feed/',
    'https://www.rogerebert.com/feed',
    'https://movieswetextedabout.com/category/movies/feed/'
];

const MAX_SOURCES = 5;

/**
 * Strict SSRF (Server-Side Request Forgery) URL Validator.
 * Enforces HTTPS, public FQDNs, standard ports, and strictly blocks
 * private IP ranges, loopback, link-local, and cloud metadata endpoints.
 */
function isValidPublicFeedUrl(urlString: string): boolean {
    if (!urlString || typeof urlString !== 'string' || urlString.length > 2048) {
        return false;
    }

    try {
        const parsed = new URL(urlString);

        // 1. Only HTTPS is permitted
        if (parsed.protocol !== 'https:') {
            return false;
        }

        // 2. Reject credentials embedded in URL (e.g. https://user:pass@domain)
        if (parsed.username || parsed.password) {
            return false;
        }

        // 3. Reject non-standard ports (allow standard 443 or default)
        if (parsed.port && parsed.port !== '443') {
            return false;
        }

        const hostname = parsed.hostname.toLowerCase();

        // 4. Reject localhost and internal local namespaces
        if (
            hostname === 'localhost' ||
            hostname.endsWith('.localhost') ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.internal') ||
            hostname.endsWith('.corp') ||
            hostname.endsWith('.lan') ||
            hostname === 'metadata.google.internal'
        ) {
            return false;
        }

        // 5. Strictly block bare IP addresses (IPv4 & IPv6)
        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        if (ipv4Regex.test(hostname)) {
            return false;
        }
        if (hostname.includes(':') || hostname.startsWith('[') || hostname.endsWith(']')) {
            return false;
        }

        // 6. Hostname must be a valid public FQDN with at least one dot
        if (!hostname.includes('.') || hostname.startsWith('.') || hostname.endsWith('.')) {
            return false;
        }

        // 7. Disallow invalid or special characters in hostname
        if (!/^[a-z0-9.-]+$/.test(hostname)) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

// Helper to extract image from RSS item
function extractImage(item: any): string | undefined {
    // 1. Check enclosure
    if (item.enclosure?.url && item.enclosure.url.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
        return item.enclosure.url;
    }
    // 2. Check media:content attribute
    if (item.mediaContent && item.mediaContent['$'] && item.mediaContent['$'].url) {
        return item.mediaContent['$'].url;
    }
    // 3. Fallback: Parse img tag from content:encoded or description
    const content = item.contentEncoded || item.content || item.description || '';
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = content.match(imgRegex);
    if (match && match[1]) {
        return match[1];
    }
    return undefined;
}

// Fetch with timeout wrapper to prevent hanging feeds from killing the whole function
async function fetchFeedWithTimeout(url: string, timeoutMs = 8000) {
    return Promise.race([
        parser.parseURL(url),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout fetching feed`)), timeoutMs)
        )
    ]);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');
        return res.status(200).end();
    }

    res.setHeader('Access-Control-Allow-Origin', '*');

    // 2. Client Origin Guard
    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 3. IP Rate Limiting Guard (30 requests / min per IP)
    if (!checkRateLimit(req, res, { windowSec: 60, maxRequests: 30 })) {
        return res;
    }

    let rawSources: string[] = [...DEFAULT_SOURCES];
    let customProvided = false;

    // Support dynamic sources
    if (req.method === 'POST') {
        const body = req.body || {};
        if (Array.isArray(body.sources) && body.sources.length > 0) {
            rawSources = body.sources;
            customProvided = true;
        }
    } else if (req.query.url) {
        const urlParam = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
        if (urlParam) {
            rawSources = [urlParam];
            customProvided = true;
        }
    }

    // Abuse prevention - Maximum sources count
    if (rawSources.length > MAX_SOURCES) {
        return res.status(400).json({
            error: `Too many sources. Maximum allowed is ${MAX_SOURCES}.`,
            status: 'error'
        });
    }

    // 3. Strict SSRF Filtering
    const sanitizedSources = rawSources.filter(isValidPublicFeedUrl);

    if (customProvided && sanitizedSources.length === 0) {
        return res.status(400).json({
            error: 'All provided feed URLs failed security validation. Only valid public HTTPS domains are allowed.',
            status: 'error'
        });
    }

    const sourcesToFetch = sanitizedSources.length > 0 ? sanitizedSources : DEFAULT_SOURCES;

    try {
        const fetchPromises = sourcesToFetch.map(sourceUrl => fetchFeedWithTimeout(sourceUrl));
        const results = await Promise.allSettled(fetchPromises);

        let allItems: any[] = [];
        const errors: string[] = [];

        results.forEach((result, index) => {
            const sourceUrl = sourcesToFetch[index];
            if (result.status === 'fulfilled') {
                const feed = result.value;
                const sourceName = feed.title || new URL(sourceUrl).hostname;

                // Parse and map items
                const mappedItems = feed.items?.map((item: any) => ({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate || item.isoDate,
                    creator: item.creator || item.author || sourceName,
                    contentSnippet: item.contentSnippet || item.snippet || '',
                    image: extractImage(item),
                    sourceName: sourceName,
                    sourceUrl: sourceUrl
                })) || [];

                allItems = [...allItems, ...mappedItems];
            } else {
                console.error(`[API - Feed] Failed to fetch feed source:`, sourceUrl);
                errors.push(`Failed to fetch feed from ${new URL(sourceUrl).hostname}`);
            }
        });

        // Sort items by pubDate (newest first)
        allItems.sort((a, b) => {
            const dateA = new Date(a.pubDate || 0).getTime();
            const dateB = new Date(b.pubDate || 0).getTime();
            return dateB - dateA;
        });

        // Limit response size
        const MAX_ITEMS = 60;
        const finalItems = allItems.slice(0, MAX_ITEMS);

        // Edge Caching: Cache for 5 minutes, serve stale while revalidating for 10 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

        return res.status(200).json({
            status: 'ok',
            items: finalItems,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: unknown) {
        console.error('[API - Feed] Unhandled Error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            status: 'error'
        });
    }
}
