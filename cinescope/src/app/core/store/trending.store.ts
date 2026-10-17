import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { TmdbTrendingMixedItemDto } from '../dtos/trending/trending-mixed-item.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { TmdbPersonListItemDto } from '../dtos/people/person-list-item.dto';
import { HeroBannerItem } from '../../shared/models/hero-banner-item.interface';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { resolveMediaImageUrl } from '../constants/api.constants';

interface TrendingState {
    heroItems: HeroBannerItem[];
    movies: SwimlaneItem[];
    tvShows: SwimlaneItem[];
    // Desi Hub
    desiMovies: SwimlaneItem[];
    desiTvShows: SwimlaneItem[];
    isDesiLoading: boolean;
    // Bollywood
    bollywoodPopular: SwimlaneItem[];
    bollywoodTopRated: SwimlaneItem[];
    isBollywoodLoading: boolean;
    // Top Rated
    topRatedMovies: SwimlaneItem[];
    topRatedTvShows: SwimlaneItem[];
    isTopRatedLoading: boolean;
    // Actors
    trendingActors: SwimlaneItem[];
    isActorsLoading: boolean;

    isLoading: boolean;
    error: string | null;
}

const initialState: TrendingState = {
    heroItems: [],
    movies: [],
    tvShows: [],
    desiMovies: [],
    desiTvShows: [],
    isDesiLoading: false,
    bollywoodPopular: [],
    bollywoodTopRated: [],
    isBollywoodLoading: false,
    topRatedMovies: [],
    topRatedTvShows: [],
    isTopRatedLoading: false,
    trendingActors: [],
    isActorsLoading: false,
    isLoading: false,
    error: null,
};

function mapToHeroItems(items: TmdbTrendingMixedItemDto[]): HeroBannerItem[] {
    const heroItems: HeroBannerItem[] = [];

    for (const item of items) {
        if (item.media_type === 'person' || !item.backdrop_path) {
            continue;
        }

        heroItems.push({
            id: item.id,
            mediaType: item.media_type,
            title: item.media_type === 'movie' ? item.title : item.name,
            overview: item.overview,
            backdropUrl: resolveMediaImageUrl(item.backdrop_path, 'w1280'),
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'NR',
        });

        if (heroItems.length === 5) {
            break;
        }
    }

    return heroItems;
}

function mapMoviesToSwimlane(items: TmdbMovieListItemDto[]): SwimlaneItem[] {
    return items
        .filter((item) => item.poster_path)
        .map((item) => ({
            id: item.id,
            mediaType: 'movie' as const,
            title: item.title,
            posterUrl: resolveMediaImageUrl(item.poster_path, 'w500'),
            bookmarkState: 'none',
            payload: item as unknown as Record<string, unknown>
        }));
}

function mapTvToSwimlane(items: TmdbTvListItemDto[]): SwimlaneItem[] {
    return items
        .filter((item) => item.poster_path)
        .map((item) => ({
            id: item.id,
            mediaType: 'tv' as const,
            title: item.name,
            posterUrl: resolveMediaImageUrl(item.poster_path, 'w500'),
            bookmarkState: 'none',
            payload: item as unknown as Record<string, unknown>
        }));
}

function mapPeopleToSwimlane(items: TmdbPersonListItemDto[]): SwimlaneItem[] {
    return items
        .filter((item) => item.profile_path)
        .map((item) => {
            const topKnownFor = item.known_for?.[0];
            const knownForTitle = topKnownFor
                ? ('title' in topKnownFor ? topKnownFor.title : topKnownFor.name)
                : item.known_for_department;
            return {
                id: item.id,
                mediaType: 'person' as const,
                title: item.name,
                subtitle: knownForTitle,
                posterUrl: resolveMediaImageUrl(item.profile_path, 'w500'),
                bookmarkState: 'none',
                payload: item as unknown as Record<string, unknown>
            };
        });
}

export const TrendingStore = signalStore(
    { providedIn: 'root' },
    withState(initialState),
    withMethods((
        store,
        trendingService = inject(TmdbTrendingService),
        discoverService = inject(TmdbDiscoverService),
        moviesService = inject(TmdbMoviesService),
        tvService = inject(TmdbTvService)
    ) => ({

        async loadTrendingData(force = false): Promise<void> {
            if (!force && store.movies().length > 0 && store.tvShows().length > 0) {
                return;
            }
            patchState(store, { isLoading: true, error: null });

            try {
                // Smart Pulse Logic: 0 = Sunday, 5 = Friday, 6 = Saturday
                const today = new Date().getDay();
                const isWeekend = today === 0 || today === 5 || today === 6;
                const pulseWindow = isWeekend ? 'week' : 'day';

                const [allRes, moviesRes, tvRes] = await Promise.all([
                    firstValueFrom(trendingService.getTrendingAll('week')),
                    firstValueFrom(trendingService.getTrendingMovies(pulseWindow)),
                    firstValueFrom(trendingService.getTrendingTvShows(pulseWindow))
                ]);

                patchState(store, {
                    heroItems: mapToHeroItems(allRes.results),
                    movies: mapMoviesToSwimlane(moviesRes.results),
                    tvShows: mapTvToSwimlane(tvRes.results),
                    isLoading: false
                });

            } catch (error) {
                console.error('Failed to load trending data', error);
                patchState(store, { isLoading: false, error: 'Failed to load feed.' });
            }
        },

        async loadDesiHubData(): Promise<void> {
            if (store.desiMovies().length > 0 || store.isDesiLoading()) return;
            patchState(store, { isDesiLoading: true });
            try {
                const [desiMoviesRes, desiTvRes] = await Promise.all([
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'hi',
                        region: 'IN',
                        sort_by: 'popularity.desc'
                    })),
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'te',
                        region: 'IN',
                        sort_by: 'popularity.desc'
                    }))
                ]);
                patchState(store, {
                    desiMovies: mapMoviesToSwimlane(desiMoviesRes.results || []),
                    desiTvShows: mapMoviesToSwimlane(desiTvRes.results || []),
                    isDesiLoading: false
                });
            } catch (error) {
                console.error('Failed to load Desi Hub data', error);
                patchState(store, { isDesiLoading: false });
            }
        },

        async loadBollywoodData(): Promise<void> {
            if (store.bollywoodPopular().length > 0 || store.isBollywoodLoading()) return;
            patchState(store, { isBollywoodLoading: true });
            try {
                const [popularRes, acclaimedRes] = await Promise.all([
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'hi',
                        sort_by: 'popularity.desc'
                    })),
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'hi',
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 100
                    }))
                ]);
                patchState(store, {
                    bollywoodPopular: mapMoviesToSwimlane(popularRes.results || []),
                    bollywoodTopRated: mapMoviesToSwimlane(acclaimedRes.results || []),
                    isBollywoodLoading: false
                });
            } catch (error) {
                console.error('Failed to load Bollywood data', error);
                patchState(store, { isBollywoodLoading: false });
            }
        },

        async loadTopRatedData(): Promise<void> {
            if (store.topRatedMovies().length > 0 || store.isTopRatedLoading()) return;
            patchState(store, { isTopRatedLoading: true });
            try {
                const [moviesRes, tvRes] = await Promise.all([
                    firstValueFrom(moviesService.getTopRatedMovies()),
                    firstValueFrom(tvService.getTopRatedTvShows())
                ]);
                patchState(store, {
                    topRatedMovies: mapMoviesToSwimlane(moviesRes.results || []),
                    topRatedTvShows: mapTvToSwimlane(tvRes.results || []),
                    isTopRatedLoading: false
                });
            } catch (error) {
                console.error('Failed to load Top Rated data', error);
                patchState(store, { isTopRatedLoading: false });
            }
        },

        async loadActorsData(): Promise<void> {
            if (store.trendingActors().length > 0 || store.isActorsLoading()) return;
            patchState(store, { isActorsLoading: true });
            try {
                const res = await firstValueFrom(trendingService.getTrendingPeople('week'));
                patchState(store, {
                    trendingActors: mapPeopleToSwimlane(res.results || []),
                    isActorsLoading: false
                });
            } catch (error) {
                console.error('Failed to load Trending Actors', error);
                patchState(store, { isActorsLoading: false });
            }
        }
    }))
);