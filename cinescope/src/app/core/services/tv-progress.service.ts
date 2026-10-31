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

export interface TvSeriesProgressMeta {
    title?: string | undefined;
    posterPath?: string | undefined;
    backdropPath?: string | undefined;
    totalSeasons?: number | undefined;
    totalEpisodes?: number | undefined;
    status?: string | undefined;
    episodeTitle?: string | undefined;
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
    daysUntil: number; // 0 = today, -1 = aired yesterday, positive = upcoming
}

export interface WatchlistReadySeries {
    tmdbId: number;
    title: string;
    posterPath?: string | undefined;
    backdropPath?: string | undefined;
    totalSeasons?: number | undefined;
    totalEpisodes?: number | undefined;
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
            return p.watchedEpisodesCount > 0 && !this.isProgressComplete(p) && (!hasEpisodes || p.watchedEpisodesCount < p.totalEpisodes);
        }).sort((a, b) => (b.lastWatchedAt ?? b.updatedAt) - (a.lastWatchedAt ?? a.updatedAt));
    });

    /**
     * TV series 100% completed.
     */
    public readonly completedSeries = computed<TvProgressDocType[]>(() => {
        return this.allProgress().filter((p) => {
            return this.isProgressComplete(p);
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
            if (!progress || (progress.watchedEpisodesCount === 0 && !progress.isMarkedComplete)) {
                const payload = (doc.payload ?? {}) as Partial<TmdbTvDetailDto>;
                const displayTitle = payload.name || (payload['title'] as string | undefined) || `Series #${doc.tmdbId}`;
                results.push({
                    tmdbId: doc.tmdbId,
                    title: String(displayTitle),
                    posterPath: payload.poster_path ?? undefined,
                    backdropPath: payload.backdrop_path ?? undefined,
                    totalSeasons: typeof payload.number_of_seasons === 'number' ? payload.number_of_seasons : undefined,
                    totalEpisodes: typeof payload.number_of_episodes === 'number' ? payload.number_of_episodes : undefined
                });
            }
        }

        return results;
    });

    /**
     * Radar of upcoming or recently aired episodes across active and watchlist series.
     * Restricts to a weekly window (-1 to +7 days) using calendar UTC comparisons.
     */
    public readonly airRadar = computed<AirRadarItem[]>(() => {
        const items: AirRadarItem[] = [];
        const seenTmdbIds = new Set<number>();

        const getCalendarDayDiff = (dateStr: string): number | null => {
            const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
            if (!match) return null;
            const y = parseInt(match[1], 10);
            const m = parseInt(match[2], 10) - 1;
            const d = parseInt(match[3], 10);
            const now = new Date();
            const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
            const targetUtc = Date.UTC(y, m, d);
            const oneDayMs = 24 * 60 * 60 * 1000;
            return Math.round((targetUtc - todayUtc) / oneDayMs);
        };

        // 1. Check actively tracked series
        for (const p of this.allProgress()) {
            if (p.nextAirDate && p.nextAirSeason && p.nextAirEpisode) {
                const daysUntil = getCalendarDayDiff(p.nextAirDate);
                if (daysUntil !== null && daysUntil >= -1 && daysUntil <= 7) {
                    if (this.isEpisodeWatched(p.tmdbId, p.nextAirSeason, p.nextAirEpisode)) {
                        continue;
                    }
                    seenTmdbIds.add(p.tmdbId);
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

        // 2. Check watchlist TV series with cached upcoming episodes
        for (const doc of this.storage.watchlistItems()) {
            if (doc.mediaType !== 'tv' || seenTmdbIds.has(doc.tmdbId)) continue;
            const payload = (doc.payload ?? {}) as Partial<TmdbTvDetailDto>;
            const nextEp = payload.next_episode_to_air;
            if (nextEp?.air_date && nextEp.season_number && nextEp.episode_number) {
                const daysUntil = getCalendarDayDiff(nextEp.air_date);
                if (daysUntil !== null && daysUntil >= -1 && daysUntil <= 7) {
                    if (this.isEpisodeWatched(doc.tmdbId, nextEp.season_number, nextEp.episode_number)) {
                        continue;
                    }
                    seenTmdbIds.add(doc.tmdbId);
                    const displayTitle = payload.name || (payload['title'] as string | undefined) || `Series #${doc.tmdbId}`;
                    items.push({
                        tmdbId: doc.tmdbId,
                        seriesTitle: String(displayTitle),
                        posterPath: payload.poster_path ?? undefined,
                        backdropPath: payload.backdrop_path ?? undefined,
                        seasonNumber: nextEp.season_number,
                        episodeNumber: nextEp.episode_number,
                        episodeTitle: nextEp.name,
                        airDate: nextEp.air_date,
                        daysUntil
                    });
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

    private countRegularEpisodes(episodeKeys: string[]): number {
        return episodeKeys.filter((key) => {
            const episode = this.parseEpisodeKey(key);
            return episode !== null && episode.season > 0;
        }).length;
    }

    private isProgressComplete(progress: TvProgressDocType): boolean {
        if (progress.isMarkedComplete) {
            return (progress.unwatchedEpisodes?.length ?? 0) === 0;
        }
        return progress.totalEpisodes > 0 && progress.watchedEpisodesCount >= progress.totalEpisodes;
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
        if (seasonNumber > 0 && progress.isMarkedComplete) {
            return !(progress.unwatchedEpisodes ?? []).includes(key);
        }
        return progress.watchedEpisodes.includes(key);
    }

    public isSeasonFullyWatched(tmdbId: number, seasonNumber: number, episodeCount: number): boolean {
        if (episodeCount <= 0) return false;
        const progress = this.getSeriesProgress(tmdbId);
        if (!progress) {
            return this.storage.watchedItems().some((w) => w.mediaType === 'tv' && w.tmdbId === tmdbId);
        }
        for (let ep = 1; ep <= episodeCount; ep++) {
            if (!this.isEpisodeWatched(tmdbId, seasonNumber, ep)) {
                return false;
            }
        }
        return true;
    }

    public async markEpisodeWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeNumber: number,
        seriesMeta?: TvSeriesProgressMeta
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        const epKey = this.getEpisodeKey(seasonNumber, episodeNumber);

        const watchedSet = new Set<string>(existing?.watchedEpisodes ?? []);
        watchedSet.add(epKey);
        const watchedList = Array.from(watchedSet);
        const unwatchedEpisodes = new Set(existing?.unwatchedEpisodes ?? []);
        if (existing?.isMarkedComplete && seasonNumber > 0) {
            unwatchedEpisodes.delete(epKey);
        }
        const regularWatchedCount = existing?.isMarkedComplete
            ? Math.max(0, (existing.totalEpisodes || 0) - unwatchedEpisodes.size)
            : this.countRegularEpisodes(watchedList);

        const doc: TvProgressDocType = {
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: seriesMeta?.title || existing?.seriesTitle || `Series #${tmdbId}`,
            totalSeasons: seriesMeta?.totalSeasons ?? existing?.totalSeasons ?? 1,
            totalEpisodes: seriesMeta?.totalEpisodes ?? existing?.totalEpisodes ?? 0,
            watchedEpisodesCount: regularWatchedCount,
            lastWatchedSeason: seasonNumber,
            lastWatchedEpisode: episodeNumber,
            lastWatchedAt: Date.now(),
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };
        if (existing?.isMarkedComplete) {
            doc.isMarkedComplete = true;
            doc.unwatchedEpisodes = Array.from(unwatchedEpisodes);
        }
        if (existing?.seasonEpisodeCounts) doc.seasonEpisodeCounts = existing.seasonEpisodeCounts;

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
        if (existing?.seasonEpisodeCounts) doc.seasonEpisodeCounts = existing.seasonEpisodeCounts;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async unmarkEpisodeWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeNumber: number,
        seriesMeta?: TvSeriesProgressMeta,
        seasons?: TmdbTvSeasonBaseDto[]
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        let watchedSet: Set<string>;
        let totalSeasons = existing?.totalSeasons ?? seriesMeta?.totalSeasons ?? 1;
        let totalEpisodes = existing?.totalEpisodes ?? seriesMeta?.totalEpisodes ?? 0;
        let title = existing?.seriesTitle || seriesMeta?.title;
        let poster = existing?.posterPath || seriesMeta?.posterPath;
        let backdrop = existing?.backdropPath || seriesMeta?.backdropPath;
        let status = existing?.status || seriesMeta?.status;
        let isMarkedComplete = existing?.isMarkedComplete ?? false;
        const unwatchedEpisodes = new Set(existing?.unwatchedEpisodes ?? []);
        let seasonEpisodeCounts = existing?.seasonEpisodeCounts ?? [];

        if (!existing) {
            // Check if series is in user's Watched list without a granular progress doc
            const watchedItem = this.storage.watchedItems().find((w) => w.mediaType === 'tv' && w.tmdbId === tmdbId);
            if (!watchedItem) return;

            const payload = (watchedItem.payload ?? {}) as Partial<TmdbTvDetailDto>;
            const fallbackTitle = payload.name || (payload['title'] as string | undefined) || `Series #${tmdbId}`;
            title = title || String(fallbackTitle);
            poster = poster || (payload.poster_path ?? undefined);
            backdrop = backdrop || (payload.backdrop_path ?? undefined);
            status = status || payload.status;
            totalSeasons = totalSeasons || payload.number_of_seasons || 1;
            totalEpisodes = totalEpisodes || payload.number_of_episodes || 0;

            const availableSeasons = (seasons && seasons.length > 0)
                ? seasons
                : (Array.isArray(payload.seasons) ? payload.seasons : []);

            watchedSet = new Set<string>();
            if (availableSeasons.length > 0) {
                for (const s of availableSeasons) {
                    if (s.season_number <= 0) continue;
                    for (let ep = 1; ep <= s.episode_count; ep++) {
                        watchedSet.add(this.getEpisodeKey(s.season_number, ep));
                    }
                }
                seasonEpisodeCounts = availableSeasons
                    .filter((season) => season.season_number > 0 && season.episode_count > 0)
                    .map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count }));
            } else {
                isMarkedComplete = true;
            }
        } else {
            watchedSet = new Set<string>(existing.watchedEpisodes);
        }

        if (seasons?.length) {
            const refreshedCounts = seasons
                .filter((season) => season.season_number > 0 && season.episode_count > 0)
                .map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count }));
            if (refreshedCounts.length > 0) seasonEpisodeCounts = refreshedCounts;
        }
        if (seasonEpisodeCounts.length > 0) {
            totalEpisodes = seasonEpisodeCounts.reduce((total, season) => total + season.episodeCount, 0);
        }

        const epKey = this.getEpisodeKey(seasonNumber, episodeNumber);
        if (isMarkedComplete && seasonNumber > 0) {
            unwatchedEpisodes.add(epKey);
        } else if (watchedSet.has(epKey)) {
            watchedSet.delete(epKey);
        } else {
            return;
        }
        const watchedList = Array.from(watchedSet);
        const regularWatchedCount = isMarkedComplete
            ? Math.max(0, totalEpisodes - unwatchedEpisodes.size)
            : this.countRegularEpisodes(watchedList);

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
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: title || `Series #${tmdbId}`,
            totalSeasons,
            totalEpisodes,
            watchedEpisodesCount: regularWatchedCount,
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };
        if (isMarkedComplete) {
            doc.isMarkedComplete = true;
            doc.unwatchedEpisodes = Array.from(unwatchedEpisodes);
        }
        if (seasonEpisodeCounts.length > 0) doc.seasonEpisodeCounts = seasonEpisodeCounts;

        if (poster) doc.posterPath = poster;
        if (backdrop) doc.backdropPath = backdrop;
        if (nextLastSeason !== undefined) doc.lastWatchedSeason = nextLastSeason;
        if (nextLastEpisode !== undefined) doc.lastWatchedEpisode = nextLastEpisode;
        if (status) doc.status = status;
        if (existing?.nextAirDate) doc.nextAirDate = existing.nextAirDate;
        if (existing?.nextAirSeason !== undefined) doc.nextAirSeason = existing.nextAirSeason;
        if (existing?.nextAirEpisode !== undefined) doc.nextAirEpisode = existing.nextAirEpisode;
        if (existing?.nextAirEpisodeTitle) doc.nextAirEpisodeTitle = existing.nextAirEpisodeTitle;
        if (existing?.seasonEpisodeCounts) doc.seasonEpisodeCounts = existing.seasonEpisodeCounts;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async toggleEpisode(
        tmdbId: number,
        seasonNumber: number,
        episodeNumber: number,
        seriesMeta?: TvSeriesProgressMeta,
        seasons?: TmdbTvSeasonBaseDto[]
    ): Promise<boolean> {
        const isWatched = this.isEpisodeWatched(tmdbId, seasonNumber, episodeNumber);
        if (isWatched) {
            await this.unmarkEpisodeWatched(tmdbId, seasonNumber, episodeNumber, seriesMeta, seasons);
            return false;
        }
        await this.markEpisodeWatched(tmdbId, seasonNumber, episodeNumber, seriesMeta);
        return true;
    }

    public async markSeasonWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeCount: number,
        seriesMeta?: TvSeriesProgressMeta
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        const watchedSet = new Set<string>(existing?.watchedEpisodes ?? []);

        for (let ep = 1; ep <= episodeCount; ep++) {
            watchedSet.add(this.getEpisodeKey(seasonNumber, ep));
        }

        const watchedList = Array.from(watchedSet);
        const unwatchedEpisodes = new Set(existing?.unwatchedEpisodes ?? []);
        if (existing?.isMarkedComplete && seasonNumber > 0) {
            for (let ep = 1; ep <= episodeCount; ep++) {
                unwatchedEpisodes.delete(this.getEpisodeKey(seasonNumber, ep));
            }
        }
        const regularWatchedCount = existing?.isMarkedComplete
            ? Math.max(0, (existing.totalEpisodes || 0) - unwatchedEpisodes.size)
            : this.countRegularEpisodes(watchedList);
        const doc: TvProgressDocType = {
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: seriesMeta?.title || existing?.seriesTitle || `Series #${tmdbId}`,
            totalSeasons: seriesMeta?.totalSeasons ?? existing?.totalSeasons ?? seasonNumber,
            totalEpisodes: seriesMeta?.totalEpisodes ?? existing?.totalEpisodes ?? 0,
            watchedEpisodesCount: regularWatchedCount,
            lastWatchedSeason: seasonNumber,
            lastWatchedEpisode: episodeCount,
            lastWatchedAt: Date.now(),
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };
        if (existing?.isMarkedComplete) {
            doc.isMarkedComplete = true;
            doc.unwatchedEpisodes = Array.from(unwatchedEpisodes);
        }
        const seasonEpisodeCounts = existing?.seasonEpisodeCounts ?? [
            { seasonNumber, episodeCount }
        ];
        if (seasonEpisodeCounts.length > 0) doc.seasonEpisodeCounts = seasonEpisodeCounts;

        const poster = seriesMeta?.posterPath || existing?.posterPath;
        if (poster) doc.posterPath = poster;

        const backdrop = seriesMeta?.backdropPath || existing?.backdropPath;
        if (backdrop) doc.backdropPath = backdrop;

        const status = seriesMeta?.status || existing?.status;
        if (status) doc.status = status;
        if (existing?.seasonEpisodeCounts) doc.seasonEpisodeCounts = existing.seasonEpisodeCounts;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async unmarkSeasonWatched(
        tmdbId: number,
        seasonNumber: number,
        episodeCount: number,
        seriesMeta?: TvSeriesProgressMeta,
        seasons?: TmdbTvSeasonBaseDto[]
    ): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(tmdbId);
        let watchedSet: Set<string>;
        let totalSeasons = existing?.totalSeasons ?? seriesMeta?.totalSeasons ?? seasonNumber;
        let totalEpisodes = existing?.totalEpisodes ?? seriesMeta?.totalEpisodes ?? 0;
        let title = existing?.seriesTitle || seriesMeta?.title;
        let poster = existing?.posterPath || seriesMeta?.posterPath;
        let backdrop = existing?.backdropPath || seriesMeta?.backdropPath;
        let status = existing?.status || seriesMeta?.status;
        let isMarkedComplete = existing?.isMarkedComplete ?? false;
        const unwatchedEpisodes = new Set(existing?.unwatchedEpisodes ?? []);
        let seasonEpisodeCounts = existing?.seasonEpisodeCounts ?? [];

        if (!existing) {
            const watchedItem = this.storage.watchedItems().find((w) => w.mediaType === 'tv' && w.tmdbId === tmdbId);
            if (!watchedItem) return;

            const payload = (watchedItem.payload ?? {}) as Partial<TmdbTvDetailDto>;
            const fallbackTitle = payload.name || (payload['title'] as string | undefined) || `Series #${tmdbId}`;
            title = title || String(fallbackTitle);
            poster = poster || (payload.poster_path ?? undefined);
            backdrop = backdrop || (payload.backdrop_path ?? undefined);
            status = status || payload.status;
            totalSeasons = totalSeasons || payload.number_of_seasons || seasonNumber;
            totalEpisodes = totalEpisodes || payload.number_of_episodes || 0;

            const availableSeasons = (seasons && seasons.length > 0)
                ? seasons
                : (Array.isArray(payload.seasons) ? payload.seasons : []);

            watchedSet = new Set<string>();
            if (availableSeasons.length > 0) {
                for (const s of availableSeasons) {
                    if (s.season_number <= 0) continue;
                    for (let ep = 1; ep <= s.episode_count; ep++) {
                        watchedSet.add(this.getEpisodeKey(s.season_number, ep));
                    }
                }
                seasonEpisodeCounts = availableSeasons
                    .filter((season) => season.season_number > 0 && season.episode_count > 0)
                    .map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count }));
            } else {
                isMarkedComplete = true;
            }
        } else {
            watchedSet = new Set<string>(existing.watchedEpisodes);
        }

        if (seasons?.length) {
            const refreshedCounts = seasons
                .filter((season) => season.season_number > 0 && season.episode_count > 0)
                .map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count }));
            if (refreshedCounts.length > 0) seasonEpisodeCounts = refreshedCounts;
        }
        if (seasonEpisodeCounts.length > 0) {
            totalEpisodes = seasonEpisodeCounts.reduce((total, season) => total + season.episodeCount, 0);
        }

        for (let ep = 1; ep <= episodeCount; ep++) {
            const key = this.getEpisodeKey(seasonNumber, ep);
            watchedSet.delete(key);
            if (isMarkedComplete && seasonNumber > 0) {
                unwatchedEpisodes.add(key);
            }
        }

        const watchedList = Array.from(watchedSet);
        const regularWatchedCount = isMarkedComplete
            ? Math.max(0, totalEpisodes - unwatchedEpisodes.size)
            : this.countRegularEpisodes(watchedList);

        // Find highest remaining episode
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
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: title || `Series #${tmdbId}`,
            totalSeasons,
            totalEpisodes,
            watchedEpisodesCount: regularWatchedCount,
            watchedEpisodes: watchedList,
            updatedAt: Date.now()
        };
        if (isMarkedComplete) {
            doc.isMarkedComplete = true;
            doc.unwatchedEpisodes = Array.from(unwatchedEpisodes);
        }
        if (seasonEpisodeCounts.length > 0) doc.seasonEpisodeCounts = seasonEpisodeCounts;

        if (poster) doc.posterPath = poster;
        if (backdrop) doc.backdropPath = backdrop;
        if (status) doc.status = status;
        if (nextLastSeason !== undefined) doc.lastWatchedSeason = nextLastSeason;
        if (nextLastEpisode !== undefined) doc.lastWatchedEpisode = nextLastEpisode;
        if (existing?.nextAirDate) doc.nextAirDate = existing.nextAirDate;
        if (existing?.nextAirSeason !== undefined) doc.nextAirSeason = existing.nextAirSeason;
        if (existing?.nextAirEpisode !== undefined) doc.nextAirEpisode = existing.nextAirEpisode;
        if (existing?.nextAirEpisodeTitle) doc.nextAirEpisodeTitle = existing.nextAirEpisodeTitle;
        if (existing?.seasonEpisodeCounts) doc.seasonEpisodeCounts = existing.seasonEpisodeCounts;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async markAllWatched(
        tmdbId: number,
        seasons: TmdbTvSeasonBaseDto[],
        seriesMeta?: TvSeriesProgressMeta
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
        const regularWatchedCount = this.countRegularEpisodes(watchedList);
        const seasonEpisodeCounts = seasons
            .filter((season) => season.season_number > 0 && season.episode_count > 0)
            .map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count }));
        const doc: TvProgressDocType = {
            id: `tv_${tmdbId}`,
            tmdbId,
            seriesTitle: seriesMeta?.title || existing?.seriesTitle || `Series #${tmdbId}`,
            totalSeasons: seriesMeta?.totalSeasons ?? existing?.totalSeasons ?? maxSeason,
            totalEpisodes: seriesMeta?.totalEpisodes ?? existing?.totalEpisodes ?? totalEpCount,
            watchedEpisodesCount: regularWatchedCount,
            lastWatchedSeason: maxSeason,
            lastWatchedEpisode: maxEpisode,
            lastWatchedAt: Date.now(),
            watchedEpisodes: watchedList,
            seasonEpisodeCounts,
            updatedAt: Date.now()
        };

        const poster = seriesMeta?.posterPath || existing?.posterPath;
        if (poster) doc.posterPath = poster;

        const backdrop = seriesMeta?.backdropPath || existing?.backdropPath;
        if (backdrop) doc.backdropPath = backdrop;

        const status = seriesMeta?.status || existing?.status;
        if (status) doc.status = status;
        if (existing?.seasonEpisodeCounts) doc.seasonEpisodeCounts = existing.seasonEpisodeCounts;

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
        if (existing.seasonEpisodeCounts) doc.seasonEpisodeCounts = existing.seasonEpisodeCounts;

        await this.dbService.db.tvProgress.upsert(doc);
    }

    public async syncSeriesMeta(detail: TmdbTvDetailDto): Promise<void> {
        this.initReactiveStream();
        const existing = this.getSeriesProgress(detail.id);
        const seasons = detail.seasons?.filter((s) => s.season_number > 0) ?? [];
        const totalSeasons = seasons.length || detail.number_of_seasons || 1;
        const seasonEpisodeCounts = seasons
            .filter((season) => season.episode_count > 0)
            .map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count }));
        const regularEpisodeTotal = seasonEpisodeCounts.reduce((total, season) => total + season.episodeCount, 0);
        const totalEpisodes = regularEpisodeTotal || detail.number_of_episodes;

        const nextEp = detail.next_episode_to_air;
        const orderedRegularKeys = seasons
            .slice()
            .sort((a, b) => a.season_number - b.season_number)
            .flatMap((season) => Array.from(
                { length: season.episode_count },
                (_, index) => this.getEpisodeKey(season.season_number, index + 1)
            ));
        let watchedEpisodes = existing?.watchedEpisodes ?? [];
        let watchedEpisodesCount = existing?.watchedEpisodesCount ?? 0;
        let isMarkedComplete = existing?.isMarkedComplete ?? false;
        let unwatchedEpisodes = existing?.unwatchedEpisodes ?? [];
        if (isMarkedComplete) {
            const exceptions = new Set(unwatchedEpisodes);
            const specialEpisodes = watchedEpisodes.filter((key) => this.parseEpisodeKey(key)?.season === 0);
            if (existing?.totalEpisodes && totalEpisodes > existing.totalEpisodes) {
                watchedEpisodes = [
                    ...specialEpisodes,
                    ...orderedRegularKeys.slice(0, existing.totalEpisodes).filter((key) => !exceptions.has(key))
                ];
                watchedEpisodesCount = this.countRegularEpisodes(watchedEpisodes);
                isMarkedComplete = false;
                unwatchedEpisodes = [];
            } else if (orderedRegularKeys.length > 0) {
                watchedEpisodes = [
                    ...specialEpisodes,
                    ...orderedRegularKeys.filter((key) => !exceptions.has(key))
                ];
                watchedEpisodesCount = Math.max(0, orderedRegularKeys.length - exceptions.size);
            } else {
                watchedEpisodesCount = Math.max(0, totalEpisodes - exceptions.size);
            }
        }

        const doc: TvProgressDocType = {
            id: `tv_${detail.id}`,
            tmdbId: detail.id,
            seriesTitle: detail.name,
            totalSeasons,
            totalEpisodes,
            watchedEpisodesCount,
            watchedEpisodes,
            seasonEpisodeCounts,
            updatedAt: Date.now()
        };
        if (isMarkedComplete) {
            doc.isMarkedComplete = true;
            doc.unwatchedEpisodes = unwatchedEpisodes;
        }

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
        const unwatchedSet = new Set<string>(progress?.unwatchedEpisodes ?? []);

        let effectiveSeasons = seasons;
        if (!effectiveSeasons || effectiveSeasons.length === 0) {
            const cachedDoc = this.storage.getCachedDoc(tmdbId, 'tv');
            const payload = cachedDoc?.payload as Partial<TmdbTvDetailDto> | undefined;
            if (payload && Array.isArray(payload.seasons)) {
                effectiveSeasons = payload.seasons;
            }
        }

        const validSeasons = (effectiveSeasons ?? [])
            .filter((s) => s.season_number > 0 && s.episode_count > 0)
            .sort((a, b) => a.season_number - b.season_number);
        const seasonCounts = validSeasons.length > 0
            ? validSeasons
            : (progress?.seasonEpisodeCounts ?? [])
                .filter((season) => season.seasonNumber > 0 && season.episodeCount > 0)
                .sort((a, b) => a.seasonNumber - b.seasonNumber)
                .map((season) => ({
                    season_number: season.seasonNumber,
                    episode_count: season.episodeCount
                }));
        if (seasonCounts.length > 0) {
            for (const s of seasonCounts) {
                for (let ep = 1; ep <= s.episode_count; ep++) {
                    const key = this.getEpisodeKey(s.season_number, ep);
                    const isWatched = progress?.isMarkedComplete
                        ? !unwatchedSet.has(key)
                        : watchedSet.has(key);
                    if (!isWatched) {
                        return { seasonNumber: s.season_number, episodeNumber: ep };
                    }
                }
            }
            // All regular episodes across all seasons are watched
            return null;
        }

        return null;
    }
}
