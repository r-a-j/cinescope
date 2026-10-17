import { Injectable } from '@angular/core';
import { HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of, tap, catchError, finalize, shareReplay } from 'rxjs';

interface CacheEntry {
    timestamp: number;
    ttlMs: number;
    data: unknown;
}

const CACHE_PREFIX = 'cinescope_api_cache_v1:';
const MAX_PERSISTED_ENTRIES = 80;

export const CACHE_TTL = {
    DISCOVER_AND_TRENDING: 12 * 60 * 60 * 1000, // 12 hours
    SEARCH_AND_DETAILS: 24 * 60 * 60 * 1000,    // 24 hours
    NEWS_FEED: 4 * 60 * 60 * 1000               // 4 hours
} as const;

@Injectable({
    providedIn: 'root'
})
export class ApiCacheService {
    private readonly memoryCache = new Map<string, CacheEntry>();
    private readonly inFlightRequests = new Map<string, Observable<HttpEvent<unknown>>>();

    /**
     * Serves fresh cached GET responses immediately (0 network calls), deduplicates concurrent
     * in-flight requests, persists responses to localStorage, and falls back to stale cache if offline.
     */
    public observeCachedGet(
        cacheKey: string,
        ttlMs: number,
        requestFactory: () => Observable<HttpEvent<unknown>>
    ): Observable<HttpEvent<unknown>> {
        const now = Date.now();
        const existing = this.getEntry(cacheKey);

        // 1. Fresh cache hit -> return immediately without hitting the network
        if (existing && now - existing.timestamp < existing.ttlMs) {
            return of(new HttpResponse({ status: 200, body: existing.data }));
        }

        // 2. Deduplicate concurrent identical requests
        const inFlight = this.inFlightRequests.get(cacheKey);
        if (inFlight) {
            return inFlight;
        }

        // 3. Perform network call, cache on 200 OK, and fallback to stale cache on network error
        const request$ = requestFactory().pipe(
            tap((event) => {
                if (event instanceof HttpResponse && event.status === 200 && event.body !== null) {
                    this.setEntry(cacheKey, {
                        timestamp: Date.now(),
                        ttlMs,
                        data: event.body
                    });
                }
            }),
            catchError((err: unknown) => {
                if (existing) {
                    console.warn(`[ApiCacheService] Network failed for ${cacheKey}, serving stale cached data.`);
                    return of(new HttpResponse({ status: 200, body: existing.data }));
                }
                throw err;
            }),
            finalize(() => {
                this.inFlightRequests.delete(cacheKey);
            }),
            shareReplay(1)
        );

        this.inFlightRequests.set(cacheKey, request$);
        return request$;
    }

    /**
     * Resolves the appropriate TTL based on the TMDB endpoint path.
     */
    public resolveTmdbTtl(targetPath: string): number {
        if (targetPath.includes('/search/') || targetPath.includes('/movie/') || targetPath.includes('/tv/')) {
            if (targetPath.includes('top_rated') || targetPath.includes('popular')) {
                return CACHE_TTL.DISCOVER_AND_TRENDING;
            }
            return CACHE_TTL.SEARCH_AND_DETAILS;
        }
        return CACHE_TTL.DISCOVER_AND_TRENDING;
    }

    /**
     * Clears both in-memory and persisted localStorage API caches.
     * Returns the total number of persisted entries removed.
     */
    public clearAll(): number {
        this.memoryCache.clear();
        this.inFlightRequests.clear();

        let removedCount = 0;
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            for (const key of keysToRemove) {
                localStorage.removeItem(key);
                removedCount++;
            }
        } catch {
            // Ignore storage access errors
        }
        return removedCount;
    }

    private getEntry(cacheKey: string): CacheEntry | null {
        const mem = this.memoryCache.get(cacheKey);
        if (mem) {
            return mem;
        }

        try {
            const raw = localStorage.getItem(CACHE_PREFIX + cacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as CacheEntry;
            if (parsed && typeof parsed.timestamp === 'number' && typeof parsed.ttlMs === 'number') {
                this.memoryCache.set(cacheKey, parsed);
                return parsed;
            }
        } catch {
            // Corrupted entry, ignore
        }
        return null;
    }

    private setEntry(cacheKey: string, entry: CacheEntry): void {
        this.memoryCache.set(cacheKey, entry);
        const storageKey = CACHE_PREFIX + cacheKey;
        const serialized = JSON.stringify(entry);

        try {
            this.enforceStorageCap();
            localStorage.setItem(storageKey, serialized);
        } catch {
            // QuotaExceededError: evict oldest half of cached entries and retry once
            this.evictOldestEntries(Math.ceil(MAX_PERSISTED_ENTRIES / 2));
            try {
                localStorage.setItem(storageKey, serialized);
            } catch {
                // Keep in memoryCache only if storage is still full
            }
        }
    }

    private enforceStorageCap(): void {
        const cacheKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                cacheKeys.push(key);
            }
        }
        if (cacheKeys.length >= MAX_PERSISTED_ENTRIES) {
            this.evictOldestEntries(cacheKeys.length - MAX_PERSISTED_ENTRIES + 10);
        }
    }

    private evictOldestEntries(countToEvict: number): void {
        try {
            const entries: { key: string; timestamp: number }[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    const raw = localStorage.getItem(key);
                    let timestamp = 0;
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw) as Partial<CacheEntry>;
                            timestamp = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0;
                        } catch {
                            timestamp = 0;
                        }
                    }
                    entries.push({ key, timestamp });
                }
            }

            entries.sort((a, b) => a.timestamp - b.timestamp);
            for (let i = 0; i < Math.min(countToEvict, entries.length); i++) {
                localStorage.removeItem(entries[i].key);
            }
        } catch {
            // Ignore eviction errors
        }
    }
}
