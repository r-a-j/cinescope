import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';
import { StorageService, getLocalTodayIso } from '../services/storage.service';
import {
    DiscoverPreferencesService,
    DiscoverLanguageOption
} from '../services/discover-preferences.service';
import { CollectionQueryContext } from '../services/collection-loader.service';
import { TmdbTrendingMixedItemDto } from '../dtos/trending/trending-mixed-item.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { TmdbPersonListItemDto } from '../dtos/people/person-list-item.dto';
import { TmdbPersonListItemDto as TmdbFindPersonListItemDto } from '../dtos/find/find-results.dto';
import { TmdbDiscoverMovieParamsDto } from '../dtos/discover/discover-movie-params.dto';
import { TmdbDiscoverTvParamsDto } from '../dtos/discover/discover-tv-params.dto';
import { HeroBannerItem } from '../../shared/models/hero-banner-item.interface';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { resolveMediaImageUrl } from '../constants/api.constants';

export interface DiscoverSwimlaneSection {
    id: string;
    title: string;
    items: SwimlaneItem[];
    queryContext: CollectionQueryContext;
}

interface TrendingState {
    heroItems: HeroBannerItem[];
    movies: SwimlaneItem[];
    nowPlayingMovies: SwimlaneItem[];
    tvShows: SwimlaneItem[];
    airingTvShows: SwimlaneItem[];
    trendingPersonalizedSections: DiscoverSwimlaneSection[];
    // Personalized For You Tab
    forYouSections: DiscoverSwimlaneSection[];
    isForYouLoading: boolean;
    // Language & World Hub (Dynamic per user language preferences)
    languageHubSections: DiscoverSwimlaneSection[];
    lastLoadedLanguageKey: string;
    desiWebSeries: SwimlaneItem[];
    teluguBlockbusters: SwimlaneItem[];
    tamilCinema: SwimlaneItem[];
    malayalamGems: SwimlaneItem[];
    isDesiLoading: boolean;
    // Bollywood (Expanded 9-row Hindi Cinema Hub)
    bollywoodSections: DiscoverSwimlaneSection[];
    bollywoodPopular: SwimlaneItem[];
    bollywoodRecent: SwimlaneItem[];
    bollywoodTopRated: SwimlaneItem[];
    isBollywoodLoading: boolean;
    // OTT & Streaming Tab
    ottStreamingSections: DiscoverSwimlaneSection[];
    isOttStreamingLoading: boolean;
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

    hasLoadedTrendingData: boolean;
    isLoading: boolean;
    error: string | null;
}

const initialState: TrendingState = {
    heroItems: [],
    movies: [],
    nowPlayingMovies: [],
    tvShows: [],
    airingTvShows: [],
    trendingPersonalizedSections: [],
    forYouSections: [],
    isForYouLoading: false,
    languageHubSections: [],
    lastLoadedLanguageKey: '',
    desiWebSeries: [],
    teluguBlockbusters: [],
    tamilCinema: [],
    malayalamGems: [],
    isDesiLoading: false,
    bollywoodSections: [],
    bollywoodPopular: [],
    bollywoodRecent: [],
    bollywoodTopRated: [],
    isBollywoodLoading: false,
    ottStreamingSections: [],
    isOttStreamingLoading: false,
    topRatedMovies: [],
    modernMasterpieces: [],
    topRatedTvShows: [],
    topRatedIndianMovies: [],
    isTopRatedLoading: false,
    trendingActors: [],
    popularActors: [],
    breakoutActors: [],
    isActorsLoading: false,

    hasLoadedTrendingData: false,
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
    return (items || [])
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
    return (items || [])
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
    return (items || [])
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

function buildLanguageSpecificConfigs(lang: DiscoverLanguageOption): {
    primaryMovieTitle: string;
    primaryMovieParams: TmdbDiscoverMovieParamsDto;
    secondaryTitle: string;
    secondaryType: 'movie' | 'tv';
    secondaryMovieParams?: TmdbDiscoverMovieParamsDto;
    secondaryTvParams?: TmdbDiscoverTvParamsDto;
} {
    const code = lang.code;
    switch (code) {
        case 'hi':
            return {
                primaryMovieTitle: 'HINDI BLOCKBUSTERS & TRENDING',
                primaryMovieParams: {
                    with_original_language: 'hi',
                    sort_by: 'popularity.desc'
                },
                secondaryTitle: 'INDIAN OTT & HINDI WEB SERIES',
                secondaryType: 'tv',
                secondaryTvParams: {
                    with_original_language: 'hi',
                    sort_by: 'popularity.desc'
                }
            };
        case 'en':
            return {
                primaryMovieTitle: 'HOLLYWOOD BLOCKBUSTERS',
                primaryMovieParams: {
                    with_original_language: 'en',
                    sort_by: 'popularity.desc'
                },
                secondaryTitle: 'PRESTIGE ENGLISH SERIES',
                secondaryType: 'tv',
                secondaryTvParams: {
                    with_original_language: 'en',
                    sort_by: 'vote_average.desc',
                    'vote_count.gte': 300
                }
            };
        case 'ko':
            return {
                primaryMovieTitle: 'KOREAN THRILLERS & CINEMA',
                primaryMovieParams: {
                    with_original_language: 'ko',
                    sort_by: 'popularity.desc',
                    'vote_count.gte': 25
                },
                secondaryTitle: 'K-DRAMA & KOREAN SERIES',
                secondaryType: 'tv',
                secondaryTvParams: {
                    with_original_language: 'ko',
                    sort_by: 'popularity.desc'
                }
            };
        case 'ja':
            return {
                primaryMovieTitle: 'ANIME FILMS & JAPANESE CINEMA',
                primaryMovieParams: {
                    with_original_language: 'ja',
                    sort_by: 'popularity.desc',
                    'vote_count.gte': 25
                },
                secondaryTitle: 'ANIME & JAPANESE SERIES',
                secondaryType: 'tv',
                secondaryTvParams: {
                    with_original_language: 'ja',
                    sort_by: 'popularity.desc'
                }
            };
        case 'de':
        case 'es':
        case 'fr':
            return {
                primaryMovieTitle: `${lang.label.toUpperCase()} CINEMA SPOTLIGHT`,
                primaryMovieParams: {
                    with_original_language: code,
                    sort_by: 'popularity.desc',
                    'vote_count.gte': 20
                },
                secondaryTitle: `POPULAR ${lang.label.toUpperCase()} SERIES`,
                secondaryType: 'tv',
                secondaryTvParams: {
                    with_original_language: code,
                    sort_by: 'popularity.desc'
                }
            };
        default:
            // Indian Regional Languages (Punjabi, Marathi, Bengali, Gujarati, Telugu, Tamil, Malayalam, Kannada)
            return {
                primaryMovieTitle: `${lang.label.toUpperCase()} BLOCKBUSTERS`,
                primaryMovieParams: {
                    with_original_language: code,
                    region: 'IN',
                    sort_by: 'popularity.desc'
                },
                secondaryTitle: `${lang.label.toUpperCase()} CRITICS' GEMS`,
                secondaryType: 'movie',
                secondaryMovieParams: {
                    with_original_language: code,
                    sort_by: 'vote_average.desc',
                    'vote_count.gte': 15
                }
            };
    }
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
        peopleService = inject(TmdbPeopleService),
        storage = inject(StorageService),
        discoverPrefs = inject(DiscoverPreferencesService)
    ) => {
        let trendingDataPromise: Promise<void> | null = null;

        const filterWatched = (items: SwimlaneItem[]): SwimlaneItem[] => {
            if (!discoverPrefs.hideWatchedInDiscover()) {
                return items;
            }
            const watchedKeys = storage.watchedMediaKeys();
            if (!watchedKeys || watchedKeys.size === 0) {
                return items;
            }
            return items.filter((it) => !watchedKeys.has(`${it.mediaType}_${it.id}`));
        };

        const buildPersonalizedTopLanes = async (): Promise<DiscoverSwimlaneSection[]> => {
            const sections: DiscoverSwimlaneSection[] = [];
            const todayIso = getLocalTodayIso();
            const preferredLangs = discoverPrefs.preferredLanguages();
            const langPipe = preferredLangs.join('|');
            const selectedGenres = discoverPrefs.selectedGenreOptions();
            const movieGenrePipe = selectedGenres.map((g) => g.movieGenreIds).join('|');
            const tvGenrePipe = selectedGenres.map((g) => g.tvGenreIds).join('|');

            // 1. Seed from user's most recent Watched or Watchlist items ("BECAUSE YOU WATCHED...")
            const watchedDocs = storage.watchedItems();
            const watchlistDocs = storage.watchlistItems();
            const seedSource = watchedDocs.length > 0 ? watchedDocs : watchlistDocs;
            const actionPrefix = watchedDocs.length > 0 ? 'BECAUSE YOU WATCHED' : 'BECAUSE YOU SAVED';
            const topSeeds = [...seedSource]
                .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
                .slice(0, 2);

            for (const seed of topSeeds) {
                const seedPayload = (seed.payload || {}) as Record<string, unknown>;
                const seedTitle = String(seedPayload['title'] || seedPayload['name'] || '').trim();
                const seedId = Number(seed.tmdbId || seedPayload['id']);
                const seedType: 'movie' | 'tv' = seed.mediaType === 'tv' ? 'tv' : 'movie';
                if (!seedId || !seedTitle) continue;

                try {
                    let recItems: SwimlaneItem[] = [];
                    if (seedType === 'tv') {
                        const res = await firstValueFrom(tvService.getTvRecommendations(seedId, 'en-US', 1));
                        recItems = filterWatched(mapTvToSwimlane(res.results || []));
                    } else {
                        const res = await firstValueFrom(moviesService.getMovieRecommendations(seedId, 'en-US', 1));
                        recItems = filterWatched(mapMoviesToSwimlane(res.results || []));
                    }

                    // Fallback to Discover matching seed's original_language + genres if TMDB /recommendations is empty
                    if (recItems.length < 4) {
                        const origLang = String(seedPayload['original_language'] || preferredLangs[0] || 'hi');
                        const rawGenres = (seedPayload['genre_ids'] as number[] | undefined)
                            || ((seedPayload['genres'] as { id: number }[] | undefined)?.map((g) => g.id))
                            || [];
                        const genreFilter = rawGenres.slice(0, 2).join('|');

                        if (seedType === 'tv') {
                            const fallbackParams: TmdbDiscoverTvParamsDto = {
                                with_original_language: origLang,
                                ...(genreFilter ? { with_genres: genreFilter } : {}),
                                sort_by: 'popularity.desc'
                            };
                            const fbRes = await firstValueFrom(discoverService.discoverTv(fallbackParams));
                            recItems = filterWatched(mapTvToSwimlane(fbRes.results || [])).filter((i) => i.id !== seedId);
                        } else {
                            const fallbackParams: TmdbDiscoverMovieParamsDto = {
                                with_original_language: origLang,
                                ...(genreFilter ? { with_genres: genreFilter } : {}),
                                sort_by: 'popularity.desc'
                            };
                            const fbRes = await firstValueFrom(discoverService.discoverMovies(fallbackParams));
                            recItems = filterWatched(mapMoviesToSwimlane(fbRes.results || [])).filter((i) => i.id !== seedId);
                        }
                    }

                    if (recItems.length > 0) {
                        sections.push({
                            id: `seed-${seedType}-${seedId}`,
                            title: `${actionPrefix} ${seedTitle.toUpperCase()}`,
                            items: recItems,
                            queryContext: {
                                type: 'recommendations',
                                id: seedId,
                                mediaType: seedType
                            }
                        });
                    }
                } catch {
                    // Continue building remaining personalized rows if one seed fails
                }
            }

            // 2. Curated For Your Taste (Movies) + Series + Upcoming in Your Languages + Quick Watch
            const curatedMoviesParams: TmdbDiscoverMovieParamsDto = {
                with_original_language: langPipe || 'hi|en',
                ...(movieGenrePipe ? { with_genres: movieGenrePipe } : {}),
                'vote_average.gte': 7.0,
                'vote_count.gte': 30,
                sort_by: 'popularity.desc'
            };

            const curatedTvParams: TmdbDiscoverTvParamsDto = {
                with_original_language: langPipe || 'hi|en',
                ...(tvGenrePipe ? { with_genres: tvGenrePipe } : {}),
                'vote_average.gte': 7.2,
                'vote_count.gte': 20,
                sort_by: 'popularity.desc'
            };

            const upcomingLangParams: TmdbDiscoverMovieParamsDto = {
                with_original_language: langPipe || 'hi|en',
                'primary_release_date.gte': todayIso,
                sort_by: 'popularity.desc'
            };

            const quickWatchParams: TmdbDiscoverMovieParamsDto = {
                with_original_language: langPipe || 'hi|en',
                'with_runtime.lte': 100,
                'vote_average.gte': 6.8,
                'vote_count.gte': 40,
                sort_by: 'popularity.desc'
            };

            const [curatedMoviesRes, curatedTvRes, upcomingRes, quickWatchRes] = await Promise.all([
                firstValueFrom(discoverService.discoverMovies(curatedMoviesParams)),
                firstValueFrom(discoverService.discoverTv(curatedTvParams)),
                firstValueFrom(discoverService.discoverMovies(upcomingLangParams)),
                firstValueFrom(discoverService.discoverMovies(quickWatchParams))
            ]);

            const curatedMovies = filterWatched(mapMoviesToSwimlane(curatedMoviesRes.results || []));
            if (curatedMovies.length > 0) {
                sections.push({
                    id: 'curated-taste-movies',
                    title: 'CURATED FOR YOUR TASTE',
                    items: curatedMovies,
                    queryContext: { type: 'discover_movies', movieParams: curatedMoviesParams }
                });
            }

            const upcomingItems = filterWatched(mapMoviesToSwimlane(upcomingRes.results || []));
            if (upcomingItems.length > 0) {
                sections.push({
                    id: 'upcoming-preferred-languages',
                    title: 'UPCOMING IN YOUR LANGUAGES',
                    items: upcomingItems,
                    queryContext: { type: 'discover_movies', movieParams: upcomingLangParams }
                });
            }

            const curatedTv = filterWatched(mapTvToSwimlane(curatedTvRes.results || []));
            if (curatedTv.length > 0) {
                sections.push({
                    id: 'curated-taste-tv',
                    title: 'SERIES FOR YOUR TASTE',
                    items: curatedTv,
                    queryContext: { type: 'discover_tv', tvParams: curatedTvParams }
                });
            }

            const quickWatchItems = filterWatched(mapMoviesToSwimlane(quickWatchRes.results || []));
            if (quickWatchItems.length > 0) {
                sections.push({
                    id: 'quick-watch-tonight',
                    title: 'QUICK WATCH TONIGHT (< 100 MINS)',
                    items: quickWatchItems,
                    queryContext: { type: 'discover_movies', movieParams: quickWatchParams }
                });
            }

            return sections;
        };

        return {

        loadTrendingData(force = false): Promise<void> {
            if (trendingDataPromise) {
                return trendingDataPromise;
            }
            if (!force && store.hasLoadedTrendingData()) {
                return Promise.resolve();
            }
            patchState(store, { isLoading: true, error: null });

            trendingDataPromise = (async (): Promise<void> => {
                try {
                    // Smart Pulse Logic: 0 = Sunday, 5 = Friday, 6 = Saturday
                    const today = new Date().getDay();
                    const isWeekend = today === 0 || today === 5 || today === 6;
                    const pulseWindow = isWeekend ? 'week' : 'day';
                    const region = storage.userRegion() || 'IN';

                    const [allRes, moviesRes, nowPlayingRes, tvRes, onTheAirRes, personalizedLanes] = await Promise.all([
                        firstValueFrom(trendingService.getTrendingAll('week')),
                        firstValueFrom(trendingService.getTrendingMovies(pulseWindow)),
                        firstValueFrom(moviesService.getNowPlayingMovies('en-US', 1, region)),
                        firstValueFrom(trendingService.getTrendingTvShows(pulseWindow)),
                        firstValueFrom(tvService.getTvOnTheAir('en-US', 1)),
                        buildPersonalizedTopLanes().catch(() => [] as DiscoverSwimlaneSection[])
                    ]);

                    patchState(store, {
                        heroItems: mapToHeroItems(allRes.results),
                        movies: filterWatched(mapMoviesToSwimlane(moviesRes.results)),
                        nowPlayingMovies: filterWatched(mapMoviesToSwimlane(nowPlayingRes.results || [])),
                        tvShows: filterWatched(mapTvToSwimlane(tvRes.results)),
                        airingTvShows: filterWatched(mapTvToSwimlane(onTheAirRes.results || [])),
                        trendingPersonalizedSections: personalizedLanes.slice(0, 3),
                        forYouSections: personalizedLanes,
                        hasLoadedTrendingData: true
                    });
                } catch (error) {
                    console.error('Failed to load trending data', error);
                    patchState(store, { error: 'Failed to load feed.' });
                } finally {
                    patchState(store, { isLoading: false });
                    trendingDataPromise = null;
                }
            })();

            return trendingDataPromise;
        },

        async loadForYouData(force = false): Promise<void> {
            if (!force && (store.forYouSections().length > 0 || store.isForYouLoading())) return;
            patchState(store, { isForYouLoading: true });
            try {
                const sections = await buildPersonalizedTopLanes();
                patchState(store, {
                    forYouSections: sections,
                    trendingPersonalizedSections: sections.slice(0, 3),
                    isForYouLoading: false
                });
            } catch (error) {
                console.error('Failed to load For You data', error);
                patchState(store, { isForYouLoading: false });
            }
        },

        async loadDesiHubData(force = false): Promise<void> {
            const selectedOptions = discoverPrefs.selectedLanguageOptions();
            const currentLangKey = selectedOptions.map((l) => l.code).join(',');

            if (
                !force &&
                store.languageHubSections().length > 0 &&
                store.lastLoadedLanguageKey() === currentLangKey
            ) {
                return;
            }
            if (store.isDesiLoading()) return;

            patchState(store, { isDesiLoading: true });
            try {
                const builtSections: DiscoverSwimlaneSection[] = [];

                // If user selected any Indian language, surface Pan-Indian OTT & Web Series first
                const hasIndianLang = selectedOptions.some((l) => l.group === 'indian');
                if (hasIndianLang) {
                    const indianOttParams: TmdbDiscoverTvParamsDto = {
                        with_origin_country: 'IN',
                        sort_by: 'popularity.desc'
                    };
                    const webSeriesRes = await firstValueFrom(discoverService.discoverTv(indianOttParams));
                    const webItems = filterWatched(mapTvToSwimlane(webSeriesRes.results || []));
                    if (webItems.length > 0) {
                        builtSections.push({
                            id: 'indian-ott-web-series',
                            title: 'INDIAN OTT & WEB SERIES',
                            items: webItems,
                            queryContext: { type: 'discover_tv', tvParams: indianOttParams }
                        });
                    }
                }

                // Dynamically fetch lanes ONLY for the languages selected by the user!
                const languageRequests = selectedOptions.map(async (lang) => {
                    const cfg = buildLanguageSpecificConfigs(lang);
                    const [primaryRes, secondaryRes] = await Promise.all([
                        firstValueFrom(discoverService.discoverMovies(cfg.primaryMovieParams)),
                        cfg.secondaryType === 'tv' && cfg.secondaryTvParams
                            ? firstValueFrom(discoverService.discoverTv(cfg.secondaryTvParams))
                            : firstValueFrom(
                                  discoverService.discoverMovies(
                                      cfg.secondaryMovieParams || cfg.primaryMovieParams
                                  )
                              )
                    ]);

                    const primaryItems = filterWatched(mapMoviesToSwimlane(primaryRes.results || []));
                    const secondaryItems =
                        cfg.secondaryType === 'tv'
                            ? filterWatched(mapTvToSwimlane((secondaryRes.results || []) as TmdbTvListItemDto[]))
                            : filterWatched(mapMoviesToSwimlane((secondaryRes.results || []) as TmdbMovieListItemDto[]));

                    return { lang, cfg, primaryItems, secondaryItems };
                });

                const languageResults = await Promise.all(languageRequests);
                for (const res of languageResults) {
                    if (res.primaryItems.length > 0) {
                        builtSections.push({
                            id: `lang-${res.lang.code}-primary`,
                            title: res.cfg.primaryMovieTitle,
                            items: res.primaryItems,
                            queryContext: {
                                type: 'discover_movies',
                                movieParams: res.cfg.primaryMovieParams
                            }
                        });
                    }
                    if (res.secondaryItems.length > 0) {
                        builtSections.push({
                            id: `lang-${res.lang.code}-secondary`,
                            title: res.cfg.secondaryTitle,
                            items: res.secondaryItems,
                            queryContext:
                                res.cfg.secondaryType === 'tv' && res.cfg.secondaryTvParams
                                    ? { type: 'discover_tv', tvParams: res.cfg.secondaryTvParams }
                                    : {
                                          type: 'discover_movies',
                                          movieParams: res.cfg.secondaryMovieParams || res.cfg.primaryMovieParams
                                      }
                        });
                    }
                }

                patchState(store, {
                    languageHubSections: builtSections,
                    lastLoadedLanguageKey: currentLangKey,
                    desiWebSeries: builtSections[0]?.items || [],
                    isDesiLoading: false
                });
            } catch (error) {
                console.error('Failed to load Language Hub data', error);
                patchState(store, { isDesiLoading: false });
            }
        },

        async loadBollywoodData(force = false): Promise<void> {
            if (!force && (store.bollywoodSections().length > 0 || store.isBollywoodLoading())) return;
            patchState(store, { isBollywoodLoading: true });
            try {
                const todayIso = getLocalTodayIso();

                const recentParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    'primary_release_date.lte': todayIso,
                    'vote_count.gte': 5,
                    sort_by: 'primary_release_date.desc'
                };
                const upcomingParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    'primary_release_date.gte': todayIso,
                    sort_by: 'popularity.desc'
                };
                const popularParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    sort_by: 'popularity.desc'
                };
                const actionCrimeParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    with_genres: '28|53|80',
                    'vote_count.gte': 15,
                    sort_by: 'popularity.desc'
                };
                const hindiSeriesParams: TmdbDiscoverTvParamsDto = {
                    with_original_language: 'hi',
                    sort_by: 'popularity.desc'
                };
                const mysteryParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    with_genres: '9648|878|53',
                    'vote_average.gte': 7.0,
                    'vote_count.gte': 25,
                    sort_by: 'vote_average.desc'
                };
                const comedyParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    with_genres: '35|10749',
                    'vote_count.gte': 20,
                    sort_by: 'popularity.desc'
                };
                const nostalgiaParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    'primary_release_date.gte': '1990-01-01',
                    'primary_release_date.lte': '2009-12-31',
                    'vote_count.gte': 50,
                    sort_by: 'vote_average.desc'
                };
                const classicsParams: TmdbDiscoverMovieParamsDto = {
                    with_original_language: 'hi',
                    sort_by: 'vote_average.desc',
                    'vote_count.gte': 120
                };

                const [
                    recentRes,
                    upcomingRes,
                    popularRes,
                    actionCrimeRes,
                    hindiSeriesRes,
                    mysteryRes,
                    comedyRes,
                    nostalgiaRes,
                    classicsRes
                ] = await Promise.all([
                    firstValueFrom(discoverService.discoverMovies(recentParams)),
                    firstValueFrom(discoverService.discoverMovies(upcomingParams)),
                    firstValueFrom(discoverService.discoverMovies(popularParams)),
                    firstValueFrom(discoverService.discoverMovies(actionCrimeParams)),
                    firstValueFrom(discoverService.discoverTv(hindiSeriesParams)),
                    firstValueFrom(discoverService.discoverMovies(mysteryParams)),
                    firstValueFrom(discoverService.discoverMovies(comedyParams)),
                    firstValueFrom(discoverService.discoverMovies(nostalgiaParams)),
                    firstValueFrom(discoverService.discoverMovies(classicsParams))
                ]);

                const bollywoodRecent = filterWatched(mapMoviesToSwimlane(recentRes.results || []));
                const bollywoodUpcoming = filterWatched(mapMoviesToSwimlane(upcomingRes.results || []));
                const bollywoodPopular = filterWatched(mapMoviesToSwimlane(popularRes.results || []));
                const bollywoodActionCrime = filterWatched(mapMoviesToSwimlane(actionCrimeRes.results || []));
                const bollywoodSeries = filterWatched(mapTvToSwimlane(hindiSeriesRes.results || []));
                const bollywoodMystery = filterWatched(mapMoviesToSwimlane(mysteryRes.results || []));
                const bollywoodComedy = filterWatched(mapMoviesToSwimlane(comedyRes.results || []));
                const bollywoodNostalgia = filterWatched(mapMoviesToSwimlane(nostalgiaRes.results || []));
                const bollywoodTopRated = filterWatched(mapMoviesToSwimlane(classicsRes.results || []));

                const candidateSections: DiscoverSwimlaneSection[] = [
                    {
                        id: 'bollywood-recent',
                        title: 'IN THEATERS & NEW HINDI RELEASES',
                        items: bollywoodRecent,
                        queryContext: { type: 'discover_movies', movieParams: recentParams }
                    },
                    {
                        id: 'bollywood-upcoming',
                        title: 'UPCOMING BOLLYWOOD CALENDAR',
                        items: bollywoodUpcoming,
                        queryContext: { type: 'discover_movies', movieParams: upcomingParams }
                    },
                    {
                        id: 'bollywood-trending',
                        title: 'TRENDING IN BOLLYWOOD',
                        items: bollywoodPopular,
                        queryContext: { type: 'discover_movies', movieParams: popularParams }
                    },
                    {
                        id: 'bollywood-crime-action',
                        title: 'HINDI CRIME, ACTION & THRILLERS',
                        items: bollywoodActionCrime,
                        queryContext: { type: 'discover_movies', movieParams: actionCrimeParams }
                    },
                    {
                        id: 'bollywood-ott-series',
                        title: 'HINDI WEB SERIES & OTT ORIGINALS',
                        items: bollywoodSeries,
                        queryContext: { type: 'discover_tv', tvParams: hindiSeriesParams }
                    },
                    {
                        id: 'bollywood-mystery',
                        title: 'MIND-BENDING & MYSTERY HINDI CINEMA',
                        items: bollywoodMystery,
                        queryContext: { type: 'discover_movies', movieParams: mysteryParams }
                    },
                    {
                        id: 'bollywood-comedy',
                        title: 'BOLLYWOOD COMEDY & FEEL-GOOD',
                        items: bollywoodComedy,
                        queryContext: { type: 'discover_movies', movieParams: comedyParams }
                    },
                    {
                        id: 'bollywood-nostalgia',
                        title: '90s & 2000s BOLLYWOOD GOLDEN NOSTALGIA',
                        items: bollywoodNostalgia,
                        queryContext: { type: 'discover_movies', movieParams: nostalgiaParams }
                    },
                    {
                        id: 'bollywood-classics',
                        title: "CRITICS' CHOICE HINDI CLASSICS",
                        items: bollywoodTopRated,
                        queryContext: { type: 'discover_movies', movieParams: classicsParams }
                    }
                ];

                patchState(store, {
                    bollywoodSections: candidateSections.filter((s) => s.items.length > 0),
                    bollywoodPopular,
                    bollywoodRecent,
                    bollywoodTopRated,
                    isBollywoodLoading: false
                });
            } catch (error) {
                console.error('Failed to load Bollywood data', error);
                patchState(store, { isBollywoodLoading: false });
            }
        },

        async loadOttStreamingData(force = false): Promise<void> {
            if (!force && (store.ottStreamingSections().length > 0 || store.isOttStreamingLoading())) return;
            patchState(store, { isOttStreamingLoading: true });
            try {
                const region = storage.userRegion() || 'IN';
                const langPipe = discoverPrefs.preferredLanguages().join('|') || 'hi|en';

                const netflixMoviesParams: TmdbDiscoverMovieParamsDto = {
                    watch_region: region,
                    with_watch_providers: '8',
                    with_watch_monetization_types: 'flatrate',
                    with_original_language: langPipe,
                    sort_by: 'popularity.desc'
                };
                const primeMoviesParams: TmdbDiscoverMovieParamsDto = {
                    watch_region: region,
                    with_watch_providers: '9|119',
                    with_watch_monetization_types: 'flatrate',
                    with_original_language: langPipe,
                    sort_by: 'popularity.desc'
                };
                const hotstarDisneyParams: TmdbDiscoverMovieParamsDto = {
                    watch_region: region,
                    with_watch_providers: '122|337',
                    with_watch_monetization_types: 'flatrate',
                    sort_by: 'popularity.desc'
                };
                const netflixSeriesParams: TmdbDiscoverTvParamsDto = {
                    watch_region: region,
                    with_watch_providers: '8',
                    with_watch_monetization_types: 'flatrate',
                    sort_by: 'popularity.desc'
                };
                const indianOttSeriesParams: TmdbDiscoverTvParamsDto = {
                    watch_region: 'IN',
                    with_watch_providers: '237|232|122',
                    with_watch_monetization_types: 'flatrate',
                    sort_by: 'popularity.desc'
                };

                const [netflixMovRes, primeMovRes, hotstarRes, netflixTvRes, indianOttRes] = await Promise.all([
                    firstValueFrom(discoverService.discoverMovies(netflixMoviesParams)),
                    firstValueFrom(discoverService.discoverMovies(primeMoviesParams)),
                    firstValueFrom(discoverService.discoverMovies(hotstarDisneyParams)),
                    firstValueFrom(discoverService.discoverTv(netflixSeriesParams)),
                    firstValueFrom(discoverService.discoverTv(indianOttSeriesParams))
                ]);

                const candidateSections: DiscoverSwimlaneSection[] = [
                    {
                        id: 'ott-netflix-movies',
                        title: 'STREAMING ON NETFLIX',
                        items: filterWatched(mapMoviesToSwimlane(netflixMovRes.results || [])),
                        queryContext: { type: 'discover_movies', movieParams: netflixMoviesParams }
                    },
                    {
                        id: 'ott-prime-movies',
                        title: 'AMAZON PRIME VIDEO HITS',
                        items: filterWatched(mapMoviesToSwimlane(primeMovRes.results || [])),
                        queryContext: { type: 'discover_movies', movieParams: primeMoviesParams }
                    },
                    {
                        id: 'ott-netflix-series',
                        title: 'NETFLIX ORIGINAL & TRENDING SERIES',
                        items: filterWatched(mapTvToSwimlane(netflixTvRes.results || [])),
                        queryContext: { type: 'discover_tv', tvParams: netflixSeriesParams }
                    },
                    {
                        id: 'ott-hotstar-disney',
                        title: 'JIOHOTSTAR & DISNEY+ SPOTLIGHT',
                        items: filterWatched(mapMoviesToSwimlane(hotstarRes.results || [])),
                        queryContext: { type: 'discover_movies', movieParams: hotstarDisneyParams }
                    },
                    {
                        id: 'ott-sonyliv-zee5',
                        title: 'SONYLIV, ZEE5 & INDIAN OTT SERIES',
                        items: filterWatched(mapTvToSwimlane(indianOttRes.results || [])),
                        queryContext: { type: 'discover_tv', tvParams: indianOttSeriesParams }
                    }
                ];

                patchState(store, {
                    ottStreamingSections: candidateSections.filter((s) => s.items.length > 0),
                    isOttStreamingLoading: false
                });
            } catch (error) {
                console.error('Failed to load OTT Streaming data', error);
                patchState(store, { isOttStreamingLoading: false });
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
                    topRatedMovies: filterWatched(mapMoviesToSwimlane(moviesRes.results || [])),
                    modernMasterpieces: filterWatched(mapMoviesToSwimlane(modernRes.results || [])),
                    topRatedTvShows: filterWatched(mapTvToSwimlane(tvRes.results || [])),
                    topRatedIndianMovies: filterWatched(mapMoviesToSwimlane(indianTopRes.results || [])),
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
        };
    })
);
