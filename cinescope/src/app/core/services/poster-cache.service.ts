import { Injectable } from '@angular/core';
import { DEFAULT_POSTER_PLACEHOLDER } from '../constants/api.constants';

const POSTER_CACHE_NAME = 'cinescope-posters-v1';
const MAX_CONCURRENT_FETCHES = 4;

@Injectable({
    providedIn: 'root'
})
export class PosterCacheService {
    private readonly memoryBlobUrls = new Map<string, string>();
    private readonly inFlightLookups = new Map<string, Promise<string>>();
    private readonly prefetchQueue: string[] = [];
    private readonly queuedSet = new Set<string>();
    private activeFetches = 0;
    private cachePromise: Promise<Cache | null> | null = null;

    /**
     * Synchronously returns an in-memory `blob:` URL if already hydrated during this session,
     * or null if it needs async lookup from CacheStorage / network.
     */
    public getImmediateUrl(remoteUrl: string | null | undefined): string | null {
        if (!remoteUrl || remoteUrl.startsWith('assets/') || remoteUrl.startsWith('blob:')) {
            return remoteUrl || DEFAULT_POSTER_PLACEHOLDER;
        }
        return this.memoryBlobUrls.get(remoteUrl) ?? null;
    }

    /**
     * Resolves a remote poster URL from:
     * 1. In-memory blob URL map (0 ms)
     * 2. Persistent device CacheStorage `cinescope-posters-v1` (~1 ms, 0 network calls, works offline)
     * 3. Network fetch (stores into CacheStorage for future offline/instant loads)
     */
    public async resolvePosterUrl(remoteUrl: string | null | undefined): Promise<string> {
        if (!remoteUrl || remoteUrl.startsWith('assets/') || remoteUrl.startsWith('blob:')) {
            return remoteUrl || DEFAULT_POSTER_PLACEHOLDER;
        }

        const memUrl = this.memoryBlobUrls.get(remoteUrl);
        if (memUrl) {
            return memUrl;
        }

        const existingLookup = this.inFlightLookups.get(remoteUrl);
        if (existingLookup) {
            return existingLookup;
        }

        const lookupPromise = this.lookupOrCacheInBackground(remoteUrl).finally(() => {
            this.inFlightLookups.delete(remoteUrl);
        });

        this.inFlightLookups.set(remoteUrl, lookupPromise);
        return lookupPromise;
    }

    /**
     * Queues an array of remote poster URLs to be cached persistently in the background
     * with bounded concurrency so Watchlist & Watched posters are available 100% offline.
     */
    public prefetchUrls(urls: string[]): void {
        for (const url of urls) {
            if (
                !url ||
                url.startsWith('assets/') ||
                url.startsWith('blob:') ||
                this.memoryBlobUrls.has(url) ||
                this.queuedSet.has(url)
            ) {
                continue;
            }
            this.queuedSet.add(url);
            this.prefetchQueue.push(url);
        }
        this.drainPrefetchQueue();
    }

    /**
     * Clears all persistently cached poster blobs and revokes in-memory object URLs.
     */
    public async clearCache(): Promise<void> {
        this.prefetchQueue.length = 0;
        this.queuedSet.clear();

        for (const blobUrl of this.memoryBlobUrls.values()) {
            if (blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(blobUrl);
            }
        }
        this.memoryBlobUrls.clear();
        this.cachePromise = null;

        if (typeof window !== 'undefined' && 'caches' in window) {
            try {
                await window.caches.delete(POSTER_CACHE_NAME);
            } catch {
                // Ignore CacheStorage deletion errors
            }
        }
    }

    private async lookupOrCacheInBackground(remoteUrl: string): Promise<string> {
        const cache = await this.getCacheStorage();
        if (cache) {
            try {
                const cachedRes = await cache.match(remoteUrl);
                if (cachedRes && cachedRes.ok) {
                    const blob = await cachedRes.blob();
                    if (blob.size > 0) {
                        const blobUrl = URL.createObjectURL(blob);
                        this.memoryBlobUrls.set(remoteUrl, blobUrl);
                        return blobUrl;
                    }
                }
            } catch {
                // Fall through to remoteUrl and queue background caching
            }
        }

        // Not in CacheStorage yet: return remoteUrl immediately for `<img src>` and queue persistent caching
        this.prefetchUrls([remoteUrl]);
        return remoteUrl;
    }

    private drainPrefetchQueue(): void {
        while (this.activeFetches < MAX_CONCURRENT_FETCHES && this.prefetchQueue.length > 0) {
            const nextUrl = this.prefetchQueue.shift();
            if (!nextUrl) break;

            this.activeFetches++;
            void this.cacheSingleUrl(nextUrl).finally(() => {
                this.activeFetches--;
                this.queuedSet.delete(nextUrl);
                this.drainPrefetchQueue();
            });
        }
    }

    private async cacheSingleUrl(remoteUrl: string): Promise<void> {
        if (this.memoryBlobUrls.has(remoteUrl)) return;

        const cache = await this.getCacheStorage();
        if (!cache) return;

        try {
            const existing = await cache.match(remoteUrl);
            if (existing && existing.ok) {
                const blob = await existing.blob();
                if (blob.size > 0 && !this.memoryBlobUrls.has(remoteUrl)) {
                    this.memoryBlobUrls.set(remoteUrl, URL.createObjectURL(blob));
                    return;
                }
            }

            const response = await fetch(remoteUrl, { mode: 'cors', credentials: 'omit' });
            if (response.ok) {
                const cloned = response.clone();
                await cache.put(remoteUrl, cloned);
                const blob = await response.blob();
                if (blob.size > 0 && !this.memoryBlobUrls.has(remoteUrl)) {
                    this.memoryBlobUrls.set(remoteUrl, URL.createObjectURL(blob));
                }
            }
        } catch {
            // Network offline or image unavailable; ignore silently
        }
    }

    private getCacheStorage(): Promise<Cache | null> {
        if (typeof window === 'undefined' || !('caches' in window)) {
            return Promise.resolve(null);
        }
        if (!this.cachePromise) {
            this.cachePromise = window.caches.open(POSTER_CACHE_NAME).catch(() => null);
        }
        return this.cachePromise;
    }
}
