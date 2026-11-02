import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface TvReleaseIntelItem {
    tmdbId: number;
    seriesTitle: string;
    seasonNumber: number;
    releaseStatus: 'confirmed' | 'planned' | 'in_production' | 'tba' | 'ended_or_canceled';
    releaseDate: string | null;
    releaseYear: number | null;
    releaseWindow: string;
    confidence: 'high' | 'medium' | 'low';
    notes: string;
    verifiedAt: number;
}

export interface TvReleaseIntelResponseDto {
    results: Omit<TvReleaseIntelItem, 'verifiedAt'>[];
    cachedAt?: number;
}

export interface TvReleaseIntelStorageCache {
    lastCheckedAt: number;
    items: Record<number, TvReleaseIntelItem>;
}

export const TV_RELEASE_INTEL_CACHE_KEY = 'cinescope_tv_release_intel_cache_v1';
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

@Injectable({
    providedIn: 'root'
})
export class TvReleaseIntelService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/tv-release-intel`;

    public readonly intelMap = signal<Map<number, TvReleaseIntelItem>>(new Map());
    private isChecking = false;

    constructor() {
        this.hydrateFromStorage();
    }

    public hydrateFromStorage(): void {
        const stored = this.readStorageCache();
        if (stored?.items) {
            const map = new Map<number, TvReleaseIntelItem>();
            for (const key of Object.keys(stored.items)) {
                const id = Number(key);
                if (id > 0) {
                    map.set(id, stored.items[id]);
                }
            }
            this.intelMap.set(map);
        }
    }

    public readStorageCache(): TvReleaseIntelStorageCache | null {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return null;
            const raw = window.localStorage.getItem(TV_RELEASE_INTEL_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as TvReleaseIntelStorageCache;
            if (typeof parsed?.lastCheckedAt === 'number' && parsed.items && typeof parsed.items === 'object') {
                return parsed;
            }
        } catch {
            // Ignore parse errors, return null
        }
        return null;
    }

    public writeStorageCache(cache: TvReleaseIntelStorageCache): void {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return;
            window.localStorage.setItem(TV_RELEASE_INTEL_CACHE_KEY, JSON.stringify(cache));
        } catch {
            // LocalStorage quota safe
        }
    }

    public isCacheExpired(lastCheckedAt?: number): boolean {
        if (!lastCheckedAt) return true;
        return Date.now() - lastCheckedAt >= TWELVE_HOURS_MS;
    }

    public getIntelForSeries(tmdbId: number): TvReleaseIntelItem | undefined {
        return this.intelMap().get(tmdbId);
    }

    /**
     * Checks the authenticity and latest release dates for watchlist & unwatched upcoming series.
     * Enforces a 12-hour background refresh cycle so that Gemini is queried at most once every 12 hours.
     */
    public async verifyReleaseDates(
        candidateSeries: { tmdbId: number; title: string; seasonNumber: number; currentAirDate?: string | null }[],
        forceRefresh = false
    ): Promise<Map<number, TvReleaseIntelItem>> {
        this.hydrateFromStorage();
        const stored = this.readStorageCache();
        const currentMap = new Map<number, TvReleaseIntelItem>(this.intelMap());

        if (candidateSeries.length === 0) {
            return currentMap;
        }

        // Check if 12-hour cache is still valid
        if (!forceRefresh && stored && !this.isCacheExpired(stored.lastCheckedAt)) {
            return currentMap;
        }

        if (this.isChecking) {
            return currentMap;
        }
        this.isChecking = true;

        try {
            // Deduplicate candidates
            const uniqueSeriesMap = new Map<number, { tmdbId: number; title: string; seasonNumber: number; currentAirDate?: string | null }>();
            for (const s of candidateSeries) {
                if (s.tmdbId > 0 && s.title.trim().length > 0) {
                    uniqueSeriesMap.set(s.tmdbId, s);
                }
            }
            const uniqueCandidates = Array.from(uniqueSeriesMap.values()).slice(0, 15);

            if (uniqueCandidates.length === 0) {
                return currentMap;
            }

            const response = await firstValueFrom(
                this.http.post<TvReleaseIntelResponseDto>(this.apiUrl, {
                    series: uniqueCandidates,
                    models: environment.geminiModels
                }).pipe(
                    catchError((err) => {
                        console.warn('[TvReleaseIntelService] Gemini release date check failed, retaining cache:', err);
                        return of(null);
                    })
                )
            );

            if (response?.results && Array.isArray(response.results)) {
                const now = Date.now();
                const updatedItems: Record<number, TvReleaseIntelItem> = stored?.items ? { ...stored.items } : {};

                for (const item of response.results) {
                    if (item.tmdbId > 0) {
                        const enrichedItem: TvReleaseIntelItem = {
                            ...item,
                            verifiedAt: now
                        };
                        currentMap.set(item.tmdbId, enrichedItem);
                        updatedItems[item.tmdbId] = enrichedItem;
                    }
                }

                this.writeStorageCache({
                    lastCheckedAt: now,
                    items: updatedItems
                });

                this.intelMap.set(currentMap);
            }
        } finally {
            this.isChecking = false;
        }

        return currentMap;
    }
}
