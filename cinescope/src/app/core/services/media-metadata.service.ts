import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TmdbMoviesService } from './tmdb-movies.service';
import { TmdbTvService } from './tmdb-tv.service';
import { StorageService } from './storage.service';
import { TvProgressService } from './tv-progress.service';
import { PosterCacheService } from './poster-cache.service';
import { DEFAULT_POSTER_PLACEHOLDER, resolveMediaImageUrl } from '../constants/api.constants';
import { TmdbTvDetailDto } from '../dtos/tv/tv-detail.dto';
import { TmdbMovieDetailDto } from '../dtos/movies/movie-detail.dto';

export interface MediaHealingTarget {
    tmdbId: number;
    mediaType: 'movie' | 'tv';
}

@Injectable({
    providedIn: 'root'
})
export class MediaMetadataService {
    private readonly tmdbMovies = inject(TmdbMoviesService);
    private readonly tmdbTv = inject(TmdbTvService);
    private readonly storage = inject(StorageService);
    private readonly tvProgress = inject(TvProgressService);
    private readonly posterCache = inject(PosterCacheService);

    private readonly inFlightLookups = new Set<string>();
    private readonly queuedKeys = new Set<string>();
    private readonly backgroundQueue: MediaHealingTarget[] = [];
    private isProcessingQueue = false;

    /**
     * Heals and refreshes metadata for a specific media item by querying TMDB live in the background,
     * patching the stored RxDB document, updating TV progress if active, and pre-warming the fresh poster.
     */
    public async healMediaMetadata(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) return false;

        const key = `${mediaType}_${tmdbId}`;
        if (this.inFlightLookups.has(key)) {
            return false;
        }

        this.inFlightLookups.add(key);

        try {
            const docId = this.storage.generateId(tmdbId, mediaType);

            if (mediaType === 'tv') {
                const detail = await firstValueFrom(this.tmdbTv.getTvShowDetails(tmdbId));
                if (!detail) return false;

                const patch: Record<string, unknown> = {
                    poster_path: detail.poster_path,
                    backdrop_path: detail.backdrop_path,
                    name: detail.name,
                    title: detail.name,
                    status: detail.status,
                    number_of_seasons: detail.number_of_seasons,
                    number_of_episodes: detail.number_of_episodes,
                    seasons: detail.seasons,
                    next_episode_to_air: detail.next_episode_to_air,
                    last_episode_to_air: detail.last_episode_to_air,
                    vote_average: detail.vote_average
                };

                await this.storage.updateMediaPayload(docId, patch);

                if (this.tvProgress.getSeriesProgress(tmdbId)) {
                    await this.tvProgress.syncSeriesMeta(detail);
                }

                if (detail.poster_path) {
                    this.posterCache.prewarmUrls([resolveMediaImageUrl(detail.poster_path, 'w342')]);
                }
            } else {
                const detail = await firstValueFrom(this.tmdbMovies.getMovieDetails(tmdbId));
                if (!detail) return false;

                const patch: Record<string, unknown> = {
                    poster_path: detail.poster_path,
                    backdrop_path: detail.backdrop_path,
                    title: detail.title,
                    status: detail.status,
                    release_date: detail.release_date,
                    vote_average: detail.vote_average
                };

                await this.storage.updateMediaPayload(docId, patch);

                if (detail.poster_path) {
                    this.posterCache.prewarmUrls([resolveMediaImageUrl(detail.poster_path, 'w342')]);
                }
            }

            return true;
        } catch (err) {
            console.debug(`[MediaMetadataService] Healing skipped/failed for ${key}:`, err);
            return false;
        } finally {
            this.inFlightLookups.delete(key);
            this.queuedKeys.delete(key);
        }
    }

    /**
     * Persists fresh TMDB details to the local library document when a details page is viewed,
     * ensuring cached poster paths, status, seasons, and air dates stay healed and up-to-date.
     */
    public async syncActiveLibraryDoc(
        tmdbId: number,
        mediaType: 'movie' | 'tv',
        details: TmdbMovieDetailDto | TmdbTvDetailDto
    ): Promise<void> {
        if (!details || !Number.isFinite(tmdbId) || tmdbId <= 0) return;

        const cached = this.storage.getCachedDoc(tmdbId, mediaType);
        if (!cached) return;

        const docId = this.storage.generateId(tmdbId, mediaType);

        try {
            if (mediaType === 'tv') {
                const tv = details as TmdbTvDetailDto;
                const patch: Record<string, unknown> = {
                    poster_path: tv.poster_path,
                    backdrop_path: tv.backdrop_path,
                    name: tv.name,
                    title: tv.name,
                    status: tv.status,
                    number_of_seasons: tv.number_of_seasons,
                    number_of_episodes: tv.number_of_episodes,
                    seasons: tv.seasons,
                    next_episode_to_air: tv.next_episode_to_air,
                    last_episode_to_air: tv.last_episode_to_air,
                    vote_average: tv.vote_average
                };
                await this.storage.updateMediaPayload(docId, patch);

                if (this.tvProgress.getSeriesProgress(tmdbId)) {
                    await this.tvProgress.syncSeriesMeta(tv);
                }
            } else {
                const movie = details as TmdbMovieDetailDto;
                const patch: Record<string, unknown> = {
                    poster_path: movie.poster_path,
                    backdrop_path: movie.backdrop_path,
                    title: movie.title,
                    status: movie.status,
                    release_date: movie.release_date,
                    vote_average: movie.vote_average
                };
                await this.storage.updateMediaPayload(docId, patch);
            }

            if (details.poster_path) {
                this.posterCache.prewarmUrls([resolveMediaImageUrl(details.poster_path, 'w342')]);
            }
        } catch (err) {
            console.debug(`[MediaMetadataService] Syncing active doc failed for ${mediaType}_${tmdbId}:`, err);
        }
    }

    /**
     * Immediate image error fallback with background healing dispatch.
     * Swaps broken <img> element to placeholder immediately and schedules background repair.
     */
    public handleImageError(event: Event, tmdbId?: number, mediaType: 'movie' | 'tv' = 'tv'): void {
        const img = event.target as HTMLImageElement | null;
        if (img && !img.src.includes(DEFAULT_POSTER_PLACEHOLDER)) {
            img.src = DEFAULT_POSTER_PLACEHOLDER;
        }

        if (tmdbId && tmdbId > 0) {
            void this.healMediaMetadata(tmdbId, mediaType);
        }
    }

    /**
     * Queues items with missing posters or metadata for asynchronous background healing.
     */
    public queueBackgroundHealing(items: MediaHealingTarget[]): void {
        for (const item of items) {
            const key = `${item.mediaType}_${item.tmdbId}`;
            if (!this.inFlightLookups.has(key) && !this.queuedKeys.has(key)) {
                this.queuedKeys.add(key);
                this.backgroundQueue.push(item);
            }
        }

        void this.processBackgroundQueue();
    }

    private async processBackgroundQueue(): Promise<void> {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        try {
            while (this.backgroundQueue.length > 0) {
                const batch = this.backgroundQueue.splice(0, 2);
                await Promise.allSettled(
                    batch.map((target) => this.healMediaMetadata(target.tmdbId, target.mediaType))
                );
                // Non-blocking polite throttle
                await new Promise((resolve) => setTimeout(resolve, 150));
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }
}
