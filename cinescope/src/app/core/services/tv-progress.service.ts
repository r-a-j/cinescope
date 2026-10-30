import { Injectable, inject, signal, computed } from '@angular/core';
import { DatabaseService } from '../database/database.service';
import { StorageService } from './storage.service';
import { TvProgressDocType } from '../database/schemas/tv-progress.schema';
import { TmdbTvSeasonBaseDto, TmdbTvDetailDto } from '../dtos/tv/tv-detail.dto';

export interface UpNextEpisodeInfo {
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle?: string | undefined;
    stillPath?: string | null | undefined;
    airDate?: string | null | undefined;
}

export interface AirRadarItem {
    tmdbId: number;
    seriesTitle: string;
    posterPath?: string | undefined;
    backdropPath?: string | undefined;
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle?: string | undefined;
    airDate: string;
    daysUntil: number; // 0 = today, negative = aired recently, positive = upcoming
}

export interface WatchlistReadySeries {
    tmdbId: number;
    title: string;
    posterPath?: string | undefined;
    backdropPath?: string | undefined;
    totalSeasons?: number | undefined;
    totalEpisodes?: number | undefined;
    firstAirDate?: string | undefined;
    overview?: string | undefined;
    rating?: number | undefined;
}

@Injectable({
    providedIn: 'root'
})
export class TvProgressService {
    private readonly dbService = inject(DatabaseService);
    private readonly storage = inject(StorageService);

    public readonly allProgress = signal<TvProgressDocType[]>([]);
    private streamsInitialized = false;

    public readonly progressByTmdbId = computed<Map<number, TvProgressDocType>>(() => {
        const map = new Map<number, TvProgressDocType>();
        for (const item of this.allProgress()) {
            map.set(item.tmdbId, item);
        }
        return map;
    });

    /**
     * TV series currently in progress (watched at least 1 episode, but not finished).
     */
    public readonly currentlyWatching = computed<TvProgressDocType[]>(() => {
        return this.allProgress().filter((p) => {
            const hasEpisodes = p.totalEpisodes > 0;
            return p.watchedEpisodesCount > 0 && (!hasEpisodes || p.watchedEpisodesCount < p.totalEpisodes);
        }).sort((a, b) => (b.lastWatchedAt ?? b.updatedAt) - (a.lastWatchedAt ?? a.updatedAt));
    });

    /**
     * TV series 100% completed.
     */
    public readonly completedSeries = computed<TvProgressDocType[]>(() => {
        return this.allProgress().filter((p) => {
            return p.totalEpisodes > 0 && p.watchedEpisodesCount >= p.totalEpisodes;
        }).sort((a, b) => (b.lastWatchedAt ?? b.updatedAt) - (a.lastWatchedAt ?? a.updatedAt));
    });

    /**
     * Watchlist TV series ready to start (either untracked or 0 episodes watched).
     * Preserves 100% backward compatibility for all existing user watchlist series.
     */
    public readonly watchlistReadyToStart = computed<WatchlistReadySeries[]>(() => {
        const watchlist = this.storage.watchlistItems().filter((item) => item.mediaType === 'tv');
        const progressMap = this.progressByTmdbId();
        const results: WatchlistReadySeries[] = [];

        for (const doc of watchlist) {
            const progress = progressMap.get(doc.tmdbId);
            if (!progress || progress.watchedEpisodesCount === 0) {
                const payload = (doc.payload ?? {}) as Record<string, unknown>;
                results.push({
                    tmdbId: doc.tmdbId,
                    title: String(payload['name'] || payload['title'] || `Series #${doc.tmdbId}`),
                    posterPath: (payload['poster_path'] || payload['posterUrl']) as string | undefined,
                    backdropPath: (payload['backdrop_path'] || payload['backdropUrl']) as string | undefined,
                    totalSeasons: typeof payload['number_of_seasons'] === 'number' ? payload['number_of_seasons'] : undefined,
                    totalEpisodes: typeof payload['number_of_episodes'] === 'number' ? payload['number_of_episodes'] : undefined,
                    firstAirDate: payload['first_air_date'] as string | undefined,
                    overview: payload['overview'] as string | undefined,
                    rating: typeof payload['vote_average'] === 'number' ? payload['vote_average'] : undefined
                });
            }
        }

        return results;
    });

    /**
     * Radar of upcoming or recently aired episodes across active and watchlist series.
     */
    public readonly airRadar = computed<AirRadarItem[]>(() => {
        const items: AirRadarItem[] = [];
        const now = new Date();
        const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const oneDayMs = 24 * 60 * 60 * 1000;

        for (const p of this.allProgress()) {
            if (p.nextAirDate && p.nextAirSeason && p.nextAirEpisode) {
                const airTime = Date.parse(p.nextAirDate);
                if (Number.isFinite(airTime)) {
                    const daysUntil = Math.round((airTime - todayUtc) / oneDayMs);
                    // Include episodes from 3 days ago up to 30 days ahead
                    if (daysUntil >= -3 && daysUntil <= 30) {
                        items.push({
                            tmdbId: p.tmdbId,
                            seriesTitle: p.seriesTitle,
                            posterPath: p.posterPath,
                            backdropPath: p.backdropPath,
                            seasonNumber: p.nextAirSeason,
                            episodeNumber: p.nextAirEpisode,
                            episodeTitle: p.nextAirEpisodeTitle,
                            airDate: p.nextAirDate,
                            daysUntil
                        });
                    }
                }
            }
        }

        return items.sort((a, b) => a.daysUntil - b.daysUntil);
    });

    constructor() {
        this.initReactiveStream();
    }

    public initReactiveStream(): void {
        if (this.streamsInitialized) return;
        if (!this.dbService.isInitialized()) {
            this.dbService.getDatabase().then(() => {
                if (!this.streamsInitialized) {
                    this.initReactiveStream();
                }
            }).catch((err) => {
                console.error('[TvProgressService] Could not initialize database for TV stream:', err);
            });
            return;
        }

        try {
            const db = this.dbService.db;
            if (!db?.tvProgress) return;

            this.streamsInitialized = true;
            db.tvProgress.find({
                sort: [{ updatedAt: 'desc' }]
            }).$.subscribe({
                next: (docs) => {
                    const list = docs.map((d) => d.toJSON() as TvProgressDocType);
                    this.allProgress.set(list);
                },
                error: (err) => {
                    console.error('[TvProgressService] Error in tvProgress stream:', err);
                }
            });
        } catch (err) {
            console.error('[TvProgressService] Stream subscription failed:', err);
        }
    }

    public getEpisodeKey(seasonNumber: number, episodeNumber: number): string {
        return `s${seasonNumber}e${episodeNumber}`;
    }

    public parseEpisodeKey(key: string): { season: number; episode: number } | null {
        const match = /^s(\d+)e(\d+)$/i.exec(key.trim());
        if (!match) return null;
        return {
            season: parseInt(match[1], 10),
            episode: parseInt(match[2], 10)
        };
    }

    public getSeriesProgress(tmdbId: number): TvProgressDocType | undefined {
        return this.progressByTmdbId().get(tmdbId);
    }

    public isEpisodeWatched(tmdbId: number, seasonNumber: number, episodeNumber: number): boolean {
        const progress = this.getSeriesProgress(tmdbId);
        if (!progress) {
            // Check if series is in user's Watched list without granular doc
            const watched = this.storage.watchedItems().some((w) => w.mediaType === 'tv' && w.tmdbId === tmdbId);
            return watched;
        }
        const key = this.getEpisodeKey(seasonNumber, episodeNumber);
        return progress.watchedEpisodes.includes(key);
    }

    public isSeasonFullyWatched(tmdbId: number, seasonNumber: number, episodeCount: number): boolean {
        if (episodeCount <= 0) return false;
        const progress = this.getSeriesProgress(tmdbId);
        if (!progress) {
            return this.storage.watchedItems().some((w) => w.mediaType === 'tv' && w.tmdbId === tmdbId);
        }
        for (let ep = 1; ep <= episodeCount; ep++) {
            if (!progress.watchedEpisodes.includes(this.getEpisodeKey(seasonNumber, ep))) {
                return false;
            }
        }
        return true;
    }

    public async markEpisodeWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeNumber: number,
        seriesMeta?: {
            title?: string | undefined;
            posterPath?: string | undefined;
            backdropPath?: string | undefined;
            totalSeasons?: number | undefined;
            totalEpisodes?: number | undefined;
            status?: string | undefined;
            episodeTitle?: string | undefined;
        }
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        const epKey = this.getEpisodeKey(seasonNumber, episodeNumber);

        const watchedSet = new Set<string>(existing?.watchedEpisodes ?? []);
        watchedSet.add(epKey);
        const watchedList = Array.from(watchedSet);

        const doc: TvProgressDocType = {
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: seriesMeta?.title || existing?.seriesTitle || `Series #${tmdbId}`,
            totalSeasons: seriesMeta?.totalSeasons ?? existing?.totalSeasons ?? 1,
            totalEpisodes: seriesMeta?.totalEpisodes ?? existing?.totalEpisodes ?? watchedList.length,
            watchedEpisodesCount: watchedList.length,
            lastWatchedSeason: seasonNumber,
            lastWatchedEpisode: episodeNumber,
            lastWatchedAt: Date.now(),
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };

        const poster = seriesMeta?.posterPath || existing?.posterPath;
        if (poster) doc.posterPath = poster;

        const backdrop = seriesMeta?.backdropPath || existing?.backdropPath;
        if (backdrop) doc.backdropPath = backdrop;

        const epTitle = seriesMeta?.episodeTitle || existing?.lastWatchedEpisodeTitle;
        if (epTitle) doc.lastWatchedEpisodeTitle = epTitle;

        const status = seriesMeta?.status || existing?.status;
        if (status) doc.status = status;

        if (existing?.nextAirDate) doc.nextAirDate = existing.nextAirDate;
        if (existing?.nextAirSeason !== undefined) doc.nextAirSeason = existing.nextAirSeason;
        if (existing?.nextAirEpisode !== undefined) doc.nextAirEpisode = existing.nextAirEpisode;
        if (existing?.nextAirEpisodeTitle) doc.nextAirEpisodeTitle = existing.nextAirEpisodeTitle;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async unmarkEpisodeWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeNumber: number
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        if (!existing) return;

        const epKey = this.getEpisodeKey(seasonNumber, episodeNumber);
        const watchedSet = new Set<string>(existing.watchedEpisodes);
        if (!watchedSet.has(epKey)) return;

        watchedSet.delete(epKey);
        const watchedList = Array.from(watchedSet);

        // Find the next most recent watched episode
        let nextLastSeason: number | undefined;
        let nextLastEpisode: number | undefined;
        if (watchedList.length > 0) {
            const sorted = watchedList.map((k) => this.parseEpisodeKey(k)).filter(Boolean) as { season: number; episode: number }[];
            sorted.sort((a, b) => a.season === b.season ? a.episode - b.episode : a.season - b.season);
            const last = sorted[sorted.length - 1];
            nextLastSeason = last.season;
            nextLastEpisode = last.episode;
        }

        const doc: TvProgressDocType = {
            id: existing.id,
            tmdbId: existing.tmdbId,
            seriesTitle: existing.seriesTitle,
            totalSeasons: existing.totalSeasons,
            totalEpisodes: existing.totalEpisodes,
            watchedEpisodesCount: watchedList.length,
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };

        if (existing.posterPath) doc.posterPath = existing.posterPath;
        if (existing.backdropPath) doc.backdropPath = existing.backdropPath;
        if (nextLastSeason !== undefined) doc.lastWatchedSeason = nextLastSeason;
        if (nextLastEpisode !== undefined) doc.lastWatchedEpisode = nextLastEpisode;
        if (existing.status) doc.status = existing.status;
        if (existing.nextAirDate) doc.nextAirDate = existing.nextAirDate;
        if (existing.nextAirSeason !== undefined) doc.nextAirSeason = existing.nextAirSeason;
        if (existing.nextAirEpisode !== undefined) doc.nextAirEpisode = existing.nextAirEpisode;
        if (existing.nextAirEpisodeTitle) doc.nextAirEpisodeTitle = existing.nextAirEpisodeTitle;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async toggleEpisode(
        tmdbId: number,
        seasonNumber: number,
        episodeNumber: number,
        seriesMeta?: {
            title?: string | undefined;
            posterPath?: string | undefined;
            backdropPath?: string | undefined;
            totalSeasons?: number | undefined;
            totalEpisodes?: number | undefined;
            status?: string | undefined;
            episodeTitle?: string | undefined;
        }
    ): Promise<boolean> {
        const isWatched = this.isEpisodeWatched(tmdbId, seasonNumber, episodeNumber);
        if (isWatched) {
            await this.unmarkEpisodeWatched(tmdbId, seasonNumber, episodeNumber);
            return false;
        }
        await this.markEpisodeWatched(tmdbId, seasonNumber, episodeNumber, seriesMeta);
        return true;
    }

    public async markSeasonWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeCount: number,
        seriesMeta?: {
            title?: string | undefined;
            posterPath?: string | undefined;
            backdropPath?: string | undefined;
            totalSeasons?: number | undefined;
            totalEpisodes?: number | undefined;
            status?: string | undefined;
        }
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        const watchedSet = new Set<string>(existing?.watchedEpisodes ?? []);

        for (let ep = 1; ep <= episodeCount; ep++) {
            watchedSet.add(this.getEpisodeKey(seasonNumber, ep));
        }

        const watchedList = Array.from(watchedSet);
        const doc: TvProgressDocType = {
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: seriesMeta?.title || existing?.seriesTitle || `Series #${tmdbId}`,
            totalSeasons: seriesMeta?.totalSeasons ?? existing?.totalSeasons ?? seasonNumber,
            totalEpisodes: seriesMeta?.totalEpisodes ?? existing?.totalEpisodes ?? watchedList.length,
            watchedEpisodesCount: watchedList.length,
            lastWatchedSeason: seasonNumber,
            lastWatchedEpisode: episodeCount,
            lastWatchedAt: Date.now(),
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };

        const poster = seriesMeta?.posterPath || existing?.posterPath;
        if (poster) doc.posterPath = poster;

        const backdrop = seriesMeta?.backdropPath || existing?.backdropPath;
        if (backdrop) doc.backdropPath = backdrop;

        const status = seriesMeta?.status || existing?.status;
        if (status) doc.status = status;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async unmarkSeasonWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeCount: number
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        if (!existing) return;

        const watchedSet = new Set<string>(existing.watchedEpisodes);
        for (let ep = 1; ep <= episodeCount; ep++) {
            watchedSet.delete(this.getEpisodeKey(seasonNumber, ep));
        }

        const watchedList = Array.from(watchedSet);
        const doc: TvProgressDocType = {
            id: existing.id,
            tmdbId: existing.tmdbId,
            seriesTitle: existing.seriesTitle,
            totalSeasons: existing.totalSeasons,
            totalEpisodes: existing.totalEpisodes,
            watchedEpisodesCount: watchedList.length,
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };

        if (existing.posterPath) doc.posterPath = existing.posterPath;
        if (existing.backdropPath) doc.backdropPath = existing.backdropPath;
        if (existing.status) doc.status = existing.status;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async markAllWatched(
        tmdbId: number,
        seasons: TmdbTvSeasonBaseDto[],
        seriesMeta?: {
            title?: string | undefined;
            posterPath?: string | undefined;
            backdropPath?: string | undefined;
            totalSeasons?: number | undefined;
            totalEpisodes?: number | undefined;
            status?: string | undefined;
        }
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        const watchedSet = new Set<string>();

        let maxSeason = 1;
        let maxEpisode = 1;
        let totalEpCount = 0;

        for (const s of seasons) {
            if (s.season_number <= 0) continue; // Exclude specials
            totalEpCount += s.episode_count;
            if (s.season_number > maxSeason) maxSeason = s.season_number;
            for (let ep = 1; ep <= s.episode_count; ep++) {
                watchedSet.add(this.getEpisodeKey(s.season_number, ep));
                if (s.season_number === maxSeason && ep > maxEpisode) {
                    maxEpisode = ep;
                }
            }
        }

        const watchedList = Array.from(watchedSet);
        const doc: TvProgressDocType = {
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: seriesMeta?.title || existing?.seriesTitle || `Series #${tmdbId}`,
            totalSeasons: seriesMeta?.totalSeasons ?? existing?.totalSeasons ?? maxSeason,
            totalEpisodes: seriesMeta?.totalEpisodes ?? existing?.totalEpisodes ?? totalEpCount,
            watchedEpisodesCount: watchedList.length,
            lastWatchedSeason: maxSeason,
            lastWatchedEpisode: maxEpisode,
            lastWatchedAt: Date.now(),
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };

        const poster = seriesMeta?.posterPath || existing?.posterPath;
        if (poster) doc.posterPath = poster;

        const backdrop = seriesMeta?.backdropPath || existing?.backdropPath;
        if (backdrop) doc.backdropPath = backdrop;

        const status = seriesMeta?.status || existing?.status;
        if (status) doc.status = status;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async resetProgress(tmdbId: number): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        if (!existing) return;

        const doc: TvProgressDocType = {
            id: existing.id,
            tmdbId: existing.tmdbId,
            seriesTitle: existing.seriesTitle,
            totalSeasons: existing.totalSeasons,
            totalEpisodes: existing.totalEpisodes,
            watchedEpisodesCount: 0,
            watchedEpisodes: [],
            updatedAt: Date.now()
        };

        if (existing.posterPath) doc.posterPath = existing.posterPath;
        if (existing.backdropPath) doc.backdropPath = existing.backdropPath;
        if (existing.status) doc.status = existing.status;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async syncSeriesMeta(detail: TmdbTvDetailDto): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(detail.id);
        const seasons = detail.seasons?.filter((s) => s.season_number > 0) ?? [];
        const totalSeasons = seasons.length || detail.number_of_seasons || 1;
        const totalEpisodes = detail.number_of_episodes || seasons.reduce((acc, s) => acc + s.episode_count, 0);

        const nextEp = detail.next_episode_to_air;
        const doc: TvProgressDocType = {
            id: `tv_${detail.id}`,
            tmdbId: detail.id,
            seriesTitle: detail.name,
            totalSeasons,
            totalEpisodes,
            watchedEpisodesCount: existing?.watchedEpisodesCount ?? 0,
            watchedEpisodes: existing?.watchedEpisodes ?? [],
            updatedAt: Date.now()
        };

        const poster = detail.poster_path ?? existing?.posterPath;
        if (poster) doc.posterPath = poster;

        const backdrop = detail.backdrop_path ?? existing?.backdropPath;
        if (backdrop) doc.backdropPath = backdrop;

        if (existing?.lastWatchedSeason !== undefined) doc.lastWatchedSeason = existing.lastWatchedSeason;
        if (existing?.lastWatchedEpisode !== undefined) doc.lastWatchedEpisode = existing.lastWatchedEpisode;
        if (existing?.lastWatchedEpisodeTitle) doc.lastWatchedEpisodeTitle = existing.lastWatchedEpisodeTitle;
        if (existing?.lastWatchedAt !== undefined) doc.lastWatchedAt = existing.lastWatchedAt;

        if (detail.status) doc.status = detail.status;
        if (nextEp?.air_date) doc.nextAirDate = nextEp.air_date;
        if (nextEp?.season_number !== undefined) doc.nextAirSeason = nextEp.season_number;
        if (nextEp?.episode_number !== undefined) doc.nextAirEpisode = nextEp.episode_number;
        if (nextEp?.name) doc.nextAirEpisodeTitle = nextEp.name;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    /**
     * Determines the Up Next episode for a given series.
     * Iterates seasons and episodes in order, returning the first unwatched episode.
     */
    public getUpNextEpisode(
        tmdbId: number,
        seasons?: TmdbTvSeasonBaseDto[]
    ): { seasonNumber: number; episodeNumber: number } | null {
        const progress = this.getSeriesProgress(tmdbId);
        const watchedSet = new Set<string>(progress?.watchedEpisodes ?? []);

        const validSeasons = (seasons ?? []).filter((s) => s.season_number > 0);
        if (validSeasons.length === 0) {
            // Fallback: if last watched season exists, next is episode + 1
            if (progress?.lastWatchedSeason && progress?.lastWatchedEpisode) {
                return {
                    seasonNumber: progress.lastWatchedSeason,
                    episodeNumber: progress.lastWatchedEpisode + 1
                };
            }
            // If completely unstarted, default to S1E1
            return { seasonNumber: 1, episodeNumber: 1 };
        }

        for (const s of validSeasons) {
            for (let ep = 1; ep <= s.episode_count; ep++) {
                const key = this.getEpisodeKey(s.season_number, ep);
                if (!watchedSet.has(key)) {
                    return { seasonNumber: s.season_number, episodeNumber: ep };
                }
            }
        }

        // All episodes watched!
        return null;
    }
}
