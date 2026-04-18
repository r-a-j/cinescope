import type { VercelRequest, VercelResponse } from '@vercel/node';
import Parser = require('rss-parser');

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
            setTimeout(() => reject(new Error(`Timeout fetching ${url}`)), timeoutMs)
        )
    ]);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<VercelResponse> {
    // 1. Handle CORS Preflight perfectly
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cinescope-client');
        return res.status(200).end();
    }

    // Apply standard CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 2. Strict Application Guard
    if (req.headers['x-cinescope-client'] !== 'CS-Mobile-App-2026') {
        return res.status(403).json({ error: 'Forbidden. Invalid Client Origin.' });
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    let sourcesToFetch = [...DEFAULT_SOURCES];

    // Support dynamic sources
    if (req.method === 'POST') {
        const body = req.body || {};
        if (Array.isArray(body.sources) && body.sources.length > 0) {
            sourcesToFetch = body.sources;
        }
    } else if (req.query.url) {
        // Fallback for single URL query (from the legacy Angular app pattern)
        const urlParam = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
        if (urlParam) sourcesToFetch = [urlParam];
    }

    // Abuse prevention
    if (sourcesToFetch.length > MAX_SOURCES) {
        return res.status(400).json({ 
            error: `Too many sources. Maximum allowed is ${MAX_SOURCES}.`,
            status: 'error'
        });
    }

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
                console.error(`[API - Feed] Failed to fetch ${sourceUrl}:`, result.reason);
                errors.push(`Failed to fetch ${sourceUrl}: ${result.reason.message}`);
            }
        });

        // Sort items by pubDate (newest first)
        allItems.sort((a, b) => {
            const dateA = new Date(a.pubDate || 0).getTime();
            const dateB = new Date(b.pubDate || 0).getTime();
            return dateB - dateA;
        });

        // Limit the total response size to avoid massive payloads
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