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
    ENTITY_DETAILS_SESSION: 15 * 60 * 1000 // 15 minutes in-memory for /movie/:id, /tv/:id, /person/:id back-navigation
} as const;

@Injectable({
    providedIn: 'root'
})
export class ApiCacheService {
    private readonly memoryCache = new Map<string, CacheEntry>();
    private readonly inFlightRequests = new Map<string, Observable<HttpEvent<unknown>>>();

    /**
     * Network-First strategy for live feeds (Discover, Trending, Now Playing, Airing, News, Search):
     * - ALWAYS fetches fresh data from the network so new content appears the moment it is out.
     * - Deduplicates concurrent identical in-flight requests.
     * - Saves the latest successful response as an offline backup and only serves it if the network fails.
     */
    public observeNetworkFirstGet(
        cacheKey: string,
        requestFactory: () => Observable<HttpEvent<unknown>>
    ): Observable<HttpEvent<unknown>> {
        const inFlight = this.inFlightRequests.get(cacheKey);
        if (inFlight) {
            return inFlight;
        }

        const existing = this.getEntry(cacheKey);

        const request$ = requestFactory().pipe(
            tap((event) => {
                if (event instanceof HttpResponse && event.status === 200 && event.body !== null) {
                    this.setEntry(cacheKey, {
                        timestamp: Date.now(),
                        ttlMs: 0,
                        data: event.body
                    });
                }
            }),
            catchError((err: unknown) => {
                if (existing) {
                    console.warn(`[ApiCacheService] Network unavailable for ${cacheKey}, falling back to last known snapshot.`);
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
     * Short in-memory session cache ONLY for individual entity detail pages (/movie/:id, /tv/:id, /person/:id)
     * so tapping Movie -> Actor -> Back to Movie doesn't re-download the same detail payload within minutes.
     */
    public observeSessionDetailGet(
        cacheKey: string,
        ttlMs: number,
        requestFactory: () => Observable<HttpEvent<unknown>>
    ): Observable<HttpEvent<unknown>> {
        const now = Date.now();
        const memEntry = this.memoryCache.get(cacheKey);

        if (memEntry && now - memEntry.timestamp < memEntry.ttlMs) {
            return of(new HttpResponse({ status: 200, body: memEntry.data }));
        }

        return this.observeNetworkFirstGet(cacheKey, requestFactory).pipe(
            tap((event) => {
                if (event instanceof HttpResponse && event.status === 200 && event.body !== null) {
                    this.memoryCache.set(cacheKey, {
                        timestamp: Date.now(),
                        ttlMs,
                        data: event.body
                    });
                }
            })
        );
    }

    /**
     * Returns true ONLY for individual Movie, TV, Season, or Person detail endpoints (e.g. /movie/123, /person/456).
     * Returns false for all Discover, Trending, Now Playing, Popular, Top Rated, On The Air, and Search endpoints.
     */
    public isStaticEntityDetailEndpoint(targetPath: string): boolean {
        if (
            targetPath.includes('/discover') ||
            targetPath.includes('/trending') ||
            targetPath.includes('/search') ||
            targetPath.includes('now_playing') ||
            targetPath.includes('on_the_air') ||
            targetPath.includes('airing_today') ||
            targetPath.includes('popular') ||
            targetPath.includes('top_rated') ||
            targetPath.includes('upcoming') ||
            targetPath.includes('latest')
        ) {
            return false;
        }
        return /^\/(movie|tv|person)\/\d+/.test(targetPath);
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
