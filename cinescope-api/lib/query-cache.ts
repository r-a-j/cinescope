/**
 * In-memory LRU TTL Cache for Semantic Search Queries
 * Reduces redundant calls to Gemini AI, saving token quota and speeding up repeated queries to < 5ms.
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_CACHE_ENTRIES = 500;

const queryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Normalizes a query string for cache key lookup (lowercased, whitespace-trimmed, symbols collapsed).
 */
export function normalizeQueryKey(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Retrieves cached data if present and not expired.
 */
export function getQueryCache<T>(rawQuery: string): T | null {
    const key = normalizeQueryKey(rawQuery);
    const entry = queryCache.get(key);

    if (!entry) {
        return null;
    }

    if (Date.now() > entry.expiresAt) {
        queryCache.delete(key);
        return null;
    }

    // Refresh position for LRU (re-insert)
    queryCache.delete(key);
    queryCache.set(key, entry);

    return entry.data as T;
}

/**
 * Stores query result in LRU cache with an expiration timestamp.
 */
export function setQueryCache<T>(rawQuery: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
    const key = normalizeQueryKey(rawQuery);

    // Evict oldest entries if capacity is reached
    if (queryCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = queryCache.keys().next().value;
        if (oldestKey) {
            queryCache.delete(oldestKey);
        }
    }

    queryCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs
    });
}

/**
 * Clears expired entries. Can be invoked periodically.
 */
export function pruneQueryCache(): void {
    const now = Date.now();
    for (const [key, entry] of queryCache.entries()) {
        if (now > entry.expiresAt) {
            queryCache.delete(key);
        }
    }
}
