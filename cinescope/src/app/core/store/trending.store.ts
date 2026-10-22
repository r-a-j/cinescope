import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';
import { TmdbTrendingMixedItemDto } from '../dtos/trending/trending-mixed-item.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { TmdbPersonListItemDto } from '../dtos/people/person-list-item.dto';
import { TmdbPersonListItemDto as TmdbFindPersonListItemDto } from '../dtos/find/find-results.dto';
import { HeroBannerItem } from '../../shared/models/hero-banner-item.interface';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { resolveMediaImageUrl } from '../constants/api.constants';

interface TrendingState {
    heroItems: HeroBannerItem[];
    movies: SwimlaneItem[];
    nowPlayingMovies: SwimlaneItem[];
    tvShows: SwimlaneItem[];
    airingTvShows: SwimlaneItem[];
    // Desi Hub (Pan-Indian & Indian OTT)
    desiWebSeries: SwimlaneItem[];
    teluguBlockbusters: SwimlaneItem[];
    tamilCinema: SwimlaneItem[];
    malayalamGems: SwimlaneItem[];
    isDesiLoading: boolean;
    // Bollywood (Hindi Cinema)
    bollywoodPopular: SwimlaneItem[];
    bollywoodRecent: SwimlaneItem[];
    bollywoodTopRated: SwimlaneItem[];
    isBollywoodLoading: boolean;
    // Top Rated
    topRatedMovies: SwimlaneItem[];
    modernMasterpieces: SwimlaneItem[];
    topRatedTvShows: SwimlaneItem[];
    topRatedIndianMovies: SwimlaneItem[];
    isTopRatedLoading: boolean;
    // Actors
    trendingActors: SwimlaneItem[];
    popularActors: SwimlaneItem[];
    breakoutActors: SwimlaneItem[];
    isActorsLoading: boolean;

    isLoading: boolean;
    error: string | null;
}

const initialState: TrendingState = {
    heroItems: [],
    movies: [],
    nowPlayingMovies: [],
    tvShows: [],
    airingTvShows: [],
    desiWebSeries: [],
    teluguBlockbusters: [],
    tamilCinema: [],
    malayalamGems: [],
    isDesiLoading: false,
    bollywoodPopular: [],
    bollywoodRecent: [],
    bollywoodTopRated: [],
    isBollywoodLoading: false,
    topRatedMovies: [],
    modernMasterpieces: [],
    topRatedTvShows: [],
    topRatedIndianMovies: [],
    isTopRatedLoading: false,
    trendingActors: [],
    popularActors: [],
    breakoutActors: [],
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

function mapPeopleToSwimlane(items: (TmdbPersonListItemDto | TmdbFindPersonListItemDto)[]): SwimlaneItem[] {
    return items
        .filter((item) => item.profile_path)
        .map((item) => {
            const knownTitles = (item.known_for ?? [])
                .map((k) => ('title' in k ? k.title : k.name))
                .filter(Boolean)
                .slice(0, 2);
            const knownForTitle = knownTitles.length > 0
                ? knownTitles.join(', ')
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
        tvService = inject(TmdbTvService),
        peopleService = inject(TmdbPeopleService)
    ) => ({

        async loadTrendingData(force = false): Promise<void> {
            if (!force && ((store.movies().length > 0 && store.tvShows().length > 0) || store.isLoading())) {
                return;
            }
            patchState(store, { isLoading: true, error: null });

            try {
                // Smart Pulse Logic: 0 = Sunday, 5 = Friday, 6 = Saturday
                const today = new Date().getDay();
                const isWeekend = today === 0 || today === 5 || today === 6;
                const pulseWindow = isWeekend ? 'week' : 'day';

                const [allRes, moviesRes, nowPlayingRes, tvRes, onTheAirRes] = await Promise.all([
                    firstValueFrom(trendingService.getTrendingAll('week')),
                    firstValueFrom(trendingService.getTrendingMovies(pulseWindow)),
                    firstValueFrom(moviesService.getNowPlayingMovies('en-US', 1, 'IN')),
                    firstValueFrom(trendingService.getTrendingTvShows(pulseWindow)),
                    firstValueFrom(tvService.getTvOnTheAir('en-US', 1))
                ]);

                patchState(store, {
                    heroItems: mapToHeroItems(allRes.results),
                    movies: mapMoviesToSwimlane(moviesRes.results),
                    nowPlayingMovies: mapMoviesToSwimlane(nowPlayingRes.results || []),
                    tvShows: mapTvToSwimlane(tvRes.results),
                    airingTvShows: mapTvToSwimlane(onTheAirRes.results || []),
                    isLoading: false
                });

            } catch (error) {
                console.error('Failed to load trending data', error);
                patchState(store, { isLoading: false, error: 'Failed to load feed.' });
            }
        },

        async loadDesiHubData(force = false): Promise<void> {
            if (!force && (store.desiWebSeries().length > 0 || store.isDesiLoading())) return;
            patchState(store, { isDesiLoading: true });
            try {
                const [webSeriesRes, teluguRes, tamilRes, malayalamRes] = await Promise.all([
                    firstValueFrom(discoverService.discoverTv({
                        with_origin_country: 'IN',
                        sort_by: 'popularity.desc'
                    })),
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'te',
                        region: 'IN',
                        sort_by: 'popularity.desc'
                    })),
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'ta',
                        region: 'IN',
                        sort_by: 'popularity.desc'
                    })),
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'ml',
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 35
                    }))
                ]);
                patchState(store, {
                    desiWebSeries: mapTvToSwimlane(webSeriesRes.results || []),
                    teluguBlockbusters: mapMoviesToSwimlane(teluguRes.results || []),
                    tamilCinema: mapMoviesToSwimlane(tamilRes.results || []),
                    malayalamGems: mapMoviesToSwimlane(malayalamRes.results || []),
                    isDesiLoading: false
                });
            } catch (error) {
                console.error('Failed to load Desi Hub data', error);
                patchState(store, { isDesiLoading: false });
            }
        },

        async loadBollywoodData(force = false): Promise<void> {
            if (!force && (store.bollywoodPopular().length > 0 || store.isBollywoodLoading())) return;
            patchState(store, { isBollywoodLoading: true });
            try {
                const todayIso = new Date().toISOString().slice(0, 10);
                const [popularRes, recentRes, acclaimedRes] = await Promise.all([
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'hi',
                        sort_by: 'popularity.desc'
                    })),
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'hi',
                        'primary_release_date.lte': todayIso,
                        'vote_count.gte': 8,
                        sort_by: 'primary_release_date.desc'
                    })),
                    firstValueFrom(discoverService.discoverMovies({
                        with_original_language: 'hi',
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 120
                    }))
                ]);
                patchState(store, {
                    bollywoodPopular: mapMoviesToSwimlane(popularRes.results || []),
                    bollywoodRecent: mapMoviesToSwimlane(recentRes.results || []),
                    bollywoodTopRated: mapMoviesToSwimlane(acclaimedRes.results || []),
                    isBollywoodLoading: false
                });
            } catch (error) {
                console.error('Failed to load Bollywood data', error);
                patchState(store, { isBollywoodLoading: false });
            }
        },

        async loadTopRatedData(force = false): Promise<void> {
            if (!force && (store.topRatedMovies().length > 0 || store.isTopRatedLoading())) return;
            patchState(store, { isTopRatedLoading: true });
            try {
                const [moviesRes, modernRes, tvRes, indianTopRes] = await Promise.all([
                    firstValueFrom(moviesService.getTopRatedMovies()),
                    firstValueFrom(discoverService.discoverMovies({
                        'primary_release_date.gte': '2020-01-01',
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 1200
                    })),
                    firstValueFrom(tvService.getTopRatedTvShows()),
                    firstValueFrom(discoverService.discoverMovies({
                        with_origin_country: 'IN',
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 150
                    }))
                ]);
                patchState(store, {
                    topRatedMovies: mapMoviesToSwimlane(moviesRes.results || []),
                    modernMasterpieces: mapMoviesToSwimlane(modernRes.results || []),
                    topRatedTvShows: mapTvToSwimlane(tvRes.results || []),
                    topRatedIndianMovies: mapMoviesToSwimlane(indianTopRes.results || []),
                    isTopRatedLoading: false
                });
            } catch (error) {
                console.error('Failed to load Top Rated data', error);
                patchState(store, { isTopRatedLoading: false });
            }
        },

        async loadActorsData(force = false): Promise<void> {
            if (!force && (store.trendingActors().length > 0 || store.isActorsLoading())) return;
            patchState(store, { isActorsLoading: true });
            try {
                const [trendingRes, popularPage1, popularPage2] = await Promise.all([
                    firstValueFrom(trendingService.getTrendingPeople('week')),
                    firstValueFrom(peopleService.getPopularPeople('en-US', 1)),
                    firstValueFrom(peopleService.getPopularPeople('en-US', 2))
                ]);
                const trendingIds = new Set((trendingRes.results || []).map((p) => p.id));
                const filteredPopular = (popularPage1.results || []).filter((p) => !trendingIds.has(p.id));

                patchState(store, {
                    trendingActors: mapPeopleToSwimlane(trendingRes.results || []),
                    popularActors: mapPeopleToSwimlane(
                        filteredPopular.length >= 6 ? filteredPopular : (popularPage1.results || [])
                    ),
                    breakoutActors: mapPeopleToSwimlane(popularPage2.results || []),
                    isActorsLoading: false
                });
            } catch (error) {
                console.error('Failed to load Trending Actors', error);
                patchState(store, { isActorsLoading: false });
            }
        }
    }))
);