import { Injectable } from '@angular/core';
import { DEFAULT_POSTER_PLACEHOLDER } from '../constants/api.constants';

const WARM_POSTERS_STORAGE_KEY = 'cinescope_warm_posters_v1';
const MAX_WARM_URLS = 600;
const MAX_PINNED_BITMAPS = 300;
const PREWARM_CONCURRENCY = 3;

@Injectable({
    providedIn: 'root'
})
export class PosterCacheService {
    private readonly warmUrls = new Set<string>();
    private readonly pinnedImages = new Map<string, HTMLImageElement>();
    private readonly prewarmQueue: string[] = [];
    private readonly queuedSet = new Set<string>();
    private activePrewarms = 0;
    private hydrated = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        void this.hydrateFromDisk();
    }

    /**
     * Hydrates the set of previously loaded poster URLs from localStorage
     * so known posters render with `loading="eager"`, `decoding="sync"`, and `opacity: 1` on frame 0.
     */
    public hydrateFromDisk(): Promise<void> {
        if (this.hydrated) {
            return Promise.resolve();
        }
        this.hydrated = true;

        try {
            const raw = localStorage.getItem(WARM_POSTERS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as unknown;
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        if (typeof item === 'string' && item) {
                            this.warmUrls.add(item);
                        }
                    }
                }
            }
        } catch {
            // Ignore localStorage read errors
        }

        return Promise.resolve();
    }

    /**
     * Returns true synchronously if the poster URL is already in Chromium's memory/disk cache
     * (or is a local asset), allowing PosterCardComponent to skip the shimmer and paint on frame 0.
     */
    public isWarm(url: string | null | undefined): boolean {
        if (!url || url.startsWith('assets/') || url.startsWith('blob:')) {
            return true;
        }
        return this.warmUrls.has(url) || this.pinnedImages.has(url);
    }

    /**
     * Pre-decodes a list of poster URLs into RAM (`HTMLImageElement.decode()`) in small batches
     * so that when the user opens Archive or switches between Watchlist and Watched,
     * the decoded bitmaps are already pinned in memory and paint on frame 0 with zero empty shells.
     */
    public prewarmUrls(urls: string[]): void {
        if (typeof Image === 'undefined') return;

        for (const url of urls) {
            if (
                !url ||
                url.startsWith('assets/') ||
                this.pinnedImages.has(url) ||
                this.queuedSet.has(url)
            ) {
                continue;
            }
            this.queuedSet.add(url);
            this.prewarmQueue.push(url);
        }

        this.drainPrewarmQueue();
    }

    /**
     * Marks a poster URL as loaded and pins a lightweight HTMLImageElement reference in RAM
     * so Chromium keeps the decoded bitmap texture in `(memory cache)` across tab switches.
     */
    public markLoaded(url: string | null | undefined, sourceImg?: HTMLImageElement): void {
        if (!url || url.startsWith('assets/') || url.startsWith('blob:')) {
            return;
        }

        if (!this.warmUrls.has(url)) {
            this.warmUrls.add(url);
            this.schedulePersistWarmUrls();
        }

        if (sourceImg && !this.pinnedImages.has(url)) {
            this.pinImageElement(url, sourceImg);
        }
    }

    /**
     * Clears the warm poster index and releases pinned in-memory image references.
     */
    public async clearCache(): Promise<void> {
        this.prewarmQueue.length = 0;
        this.queuedSet.clear();
        this.warmUrls.clear();
        this.pinnedImages.clear();

        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        try {
            localStorage.removeItem(WARM_POSTERS_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }

        if (typeof window !== 'undefined' && 'caches' in window) {
            try {
                await window.caches.delete('cinescope-posters-v1');
            } catch {
                // Ignore legacy CacheStorage cleanup errors
            }
        }
    }

    public resolveFallbackUrl(url: string | null | undefined): string {
        return url || DEFAULT_POSTER_PLACEHOLDER;
    }

    private drainPrewarmQueue(): void {
        while (this.activePrewarms < PREWARM_CONCURRENCY && this.prewarmQueue.length > 0) {
            const nextUrl = this.prewarmQueue.shift();
            if (!nextUrl) break;

            this.activePrewarms++;
            void this.decodeAndPinUrl(nextUrl).finally(() => {
                this.activePrewarms--;
                this.queuedSet.delete(nextUrl);
                this.drainPrewarmQueue();
            });
        }
    }

    private async decodeAndPinUrl(url: string): Promise<void> {
        if (this.pinnedImages.has(url)) return;

        try {
            const img = new Image();
            img.decoding = 'async';
            img.src = url;
            if (typeof img.decode === 'function') {
                await img.decode();
            } else {
                await new Promise<void>((resolve, reject) => {
                    img.onload = (): void => resolve();
                    img.onerror = (): void => reject(new Error('Image load failed'));
                });
            }
            this.pinImageElement(url, img);
            if (!this.warmUrls.has(url)) {
                this.warmUrls.add(url);
                this.schedulePersistWarmUrls();
            }
        } catch {
            // Ignore decode errors for offline/missing images
        }
    }

    private pinImageElement(url: string, img: HTMLImageElement): void {
        if (this.pinnedImages.size >= MAX_PINNED_BITMAPS) {
            const oldestKey = this.pinnedImages.keys().next().value;
            if (oldestKey) {
                this.pinnedImages.delete(oldestKey);
            }
        }
        this.pinnedImages.set(url, img);
    }

    private schedulePersistWarmUrls(): void {
        if (this.saveTimer) {
            return;
        }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            try {
                const all = Array.from(this.warmUrls);
                const trimmed = all.length > MAX_WARM_URLS ? all.slice(all.length - MAX_WARM_URLS) : all;
                localStorage.setItem(WARM_POSTERS_STORAGE_KEY, JSON.stringify(trimmed));
            } catch {
                // Ignore storage quota errors
            }
        }, 500);
    }
}
