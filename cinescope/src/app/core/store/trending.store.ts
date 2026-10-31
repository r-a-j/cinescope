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
    DiscoverLanguageOption,
    AiTasteCachedLane
} from '../services/discover-preferences.service';
import { SmartSearchService, SemanticIntentSection } from '../services/smart-search.service';
import { TmdbSearchService } from '../services/tmdb-search.service';
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
    isAiTasteSyncing: boolean;
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
    // Actors & Creators Hub
    trendingActors: SwimlaneItem[];
    indianActors: SwimlaneItem[];
    popularActors: SwimlaneItem[];
    worldActors: SwimlaneItem[];
    visionaryDirectors: SwimlaneItem[];
    breakoutActors: SwimlaneItem[];
    favoriteStarMovies: SwimlaneItem[];
    spotlightStarId: number | null;
    spotlightStarCriticalMovies: SwimlaneItem[];
    spotlightStarPopularMovies: SwimlaneItem[];
    isSpotlightStarLoading: boolean;
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
    isAiTasteSyncing: false,
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
    indianActors: [],
    popularActors: [],
    worldActors: [],
    visionaryDirectors: [],
    breakoutActors: [],
    favoriteStarMovies: [],
    spotlightStarId: null,
    spotlightStarCriticalMovies: [],
    spotlightStarPopularMovies: [],
    isSpotlightStarLoading: false,
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
            if (lang.group === 'global') {
                return {
                    primaryMovieTitle: `${lang.label.toUpperCase()} CINEMA SPOTLIGHT`,
                    primaryMovieParams: {
                        with_original_language: code,
                        sort_by: 'popularity.desc',
                        'vote_count.gte': 10
                    },
                    secondaryTitle: `POPULAR ${lang.label.toUpperCase()} SERIES`,
                    secondaryType: 'tv',
                    secondaryTvParams: {
                        with_original_language: code,
                        sort_by: 'popularity.desc'
                    }
                };
            }
            // Indian Regional Languages (Punjabi, Marathi, Bengali, Gujarati, Telugu, Tamil, Malayalam, Kannada, Odia, Urdu, Assamese, etc.)
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
                    'vote_count.gte': 10
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
        searchService = inject(TmdbSearchService),
        smartSearchService = inject(SmartSearchService),
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

        /**
         * Resolves 12-hour Gemini AI Taste lanes from the user's Watched & Watchlist history.
         * Never hallucinates movie titles: Gemini only proposes TMDB Discover query graphs
         * (genres, keywords, actors, sort_by) which are resolved against real TMDB endpoints
         * and cached for 12 hours in localStorage.
         */
        const hydrateAiTasteSections = async (
            langPipe: string,
            forceRefresh = false
        ): Promise<DiscoverSwimlaneSection[]> => {
            let cachedPayload = forceRefresh ? null : discoverPrefs.getValidAiTasteCache();

            if (!cachedPayload) {
                const watchedDocs = storage.watchedItems();
                const watchlistDocs = storage.watchlistItems();
                const combinedLibrary = [...watchedDocs, ...watchlistDocs].sort((a, b) =>
                    (b.addedAt || '').localeCompare(a.addedAt || '')
                );

                const seedTitles = combinedLibrary
                    .map((doc) => {
                        const p = (doc.payload || {}) as Record<string, unknown>;
                        return String(p['title'] || p['name'] || '').trim();
                    })
                    .filter(Boolean)
                    .slice(0, 4);

                const genreLabels = discoverPrefs
                    .selectedGenreOptions()
                    .slice(0, 3)
                    .map((g) => g.label)
                    .join(', ');
                const vibeLabels = discoverPrefs
                    .selectedVibeOptions()
                    .slice(0, 2)
                    .map((v) => v.label)
                    .join(', ');

                const tasteContext =
                    seedTitles.length > 0
                        ? `fan of ${seedTitles.join(', ')}`
                        : `fan of ${[genreLabels, vibeLabels].filter(Boolean).join(', ') || 'thriller and sci-fi cinema'}`;

                const aiQuery = `Curate 3 distinct movie or TV discover categories for a ${tasteContext}`.slice(0, 260);

                patchState(store, { isAiTasteSyncing: true });
                try {
                    const aiResponse = await firstValueFrom(smartSearchService.getSmartSuggestions(aiQuery));
                    const rawSections: SemanticIntentSection[] = (aiResponse.sections || []).slice(0, 4);
                    const builtLanes: AiTasteCachedLane[] = [];

                    for (let idx = 0; idx < rawSections.length; idx++) {
                        const sec = rawSections[idx];
                        if (sec.action !== 'discover_movies' && sec.action !== 'discover_tv') {
                            continue;
                        }

                        const rawTitle = (sec.title || '').trim();
                        if (!rawTitle) continue;

                        let castId: string | undefined;
                        if (sec.parameters?.person_name) {
                            try {
                                const pRes = await firstValueFrom(
                                    searchService.searchPerson(sec.parameters.person_name, 1)
                                );
                                if (pRes.results && pRes.results.length > 0) {
                                    castId = String(pRes.results[0].id);
                                }
                            } catch {
                                // Ignore person lookup failure
                            }
                        }

                        let keywordPipe: string | undefined;
                        if (sec.parameters?.keywords && sec.parameters.keywords.length > 0) {
                            try {
                                const kwIds = await Promise.all(
                                    sec.parameters.keywords.slice(0, 3).map(async (kw) => {
                                        const kwRes = await firstValueFrom(searchService.searchKeywords(kw, 1));
                                        return kwRes.results?.[0]?.id ? String(kwRes.results[0].id) : null;
                                    })
                                );
                                const validKw = kwIds.filter((k): k is string => !!k);
                                if (validKw.length > 0) {
                                    keywordPipe = validKw.join('|');
                                }
                            } catch {
                                // Ignore keyword lookup failure
                            }
                        }

                        const genrePipe =
                            sec.parameters?.genres && sec.parameters.genres.length > 0
                                ? sec.parameters.genres.join('|')
                                : undefined;

                        if (sec.action === 'discover_tv') {
                            const tvParams: TmdbDiscoverTvParamsDto = {
                                ...(langPipe ? { with_original_language: langPipe } : {}),
                                ...(genrePipe ? { with_genres: genrePipe } : {}),
                                ...(keywordPipe ? { with_keywords: keywordPipe } : {}),
                                sort_by: 'popularity.desc',
                                'vote_count.gte': 15
                            };
                            builtLanes.push({
                                id: `ai-taste-tv-${idx}`,
                                title: `AI CURATED: ${rawTitle.toUpperCase()}`,
                                mediaType: 'tv',
                                tvParams
                            });
                        } else {
                            const movieParams: TmdbDiscoverMovieParamsDto = {
                                ...(!castId && langPipe ? { with_original_language: langPipe } : {}),
                                ...(castId ? { with_cast: castId } : {}),
                                ...(genrePipe ? { with_genres: genrePipe } : {}),
                                ...(keywordPipe ? { with_keywords: keywordPipe } : {}),
                                sort_by: sec.parameters?.sort_by || 'popularity.desc',
                                'vote_count.gte': 20
                            };
                            builtLanes.push({
                                id: `ai-taste-movie-${idx}`,
                                title: `AI CURATED: ${rawTitle.toUpperCase()}`,
                                mediaType: 'movie',
                                movieParams
                            });
                        }
                    }

                    if (builtLanes.length > 0) {
                        cachedPayload = discoverPrefs.saveAiTasteCache(builtLanes, tasteContext);
                    }
                } catch {
                    // Gracefully fall back if offline or Gemini quota reached
                    cachedPayload = discoverPrefs.aiTasteCache();
                } finally {
                    patchState(store, { isAiTasteSyncing: false });
                }
            }

            if (!cachedPayload || cachedPayload.lanes.length === 0) {
                return [];
            }

            const hydratedSections: DiscoverSwimlaneSection[] = [];
            await Promise.all(
                cachedPayload.lanes.map(async (lane) => {
                    try {
                        if (lane.mediaType === 'tv' && lane.tvParams) {
                            const res = await firstValueFrom(discoverService.discoverTv(lane.tvParams));
                            const items = filterWatched(mapTvToSwimlane(res.results || []));
                            if (items.length > 0) {
                                hydratedSections.push({
                                    id: lane.id,
                                    title: lane.title,
                                    items,
                                    queryContext: { type: 'discover_tv', tvParams: lane.tvParams }
                                });
                            }
                        } else if (lane.movieParams) {
                            const res = await firstValueFrom(discoverService.discoverMovies(lane.movieParams));
                            const items = filterWatched(mapMoviesToSwimlane(res.results || []));
                            if (items.length > 0) {
                                hydratedSections.push({
                                    id: lane.id,
                                    title: lane.title,
                                    items,
                                    queryContext: { type: 'discover_movies', movieParams: lane.movieParams }
                                });
                            }
                        }
                    } catch {
                        // Skip failed lane
                    }
                })
            );

            return hydratedSections;
        };

        const buildPersonalizedTopLanes = async (forceAiRefresh = false): Promise<DiscoverSwimlaneSection[]> => {
            const sections: DiscoverSwimlaneSection[] = [];
            const todayIso = getLocalTodayIso();
            const preferredLangs = discoverPrefs.preferredLanguages();
            const langPipe = preferredLangs.join('|');
            const selectedGenres = discoverPrefs.selectedGenreOptions();
            const selectedVibes = discoverPrefs.selectedVibeOptions();
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

            // 2. 12-Hour Gemini AI Taste Curation (Zero-Hallucination TMDB Discover Execution Graph)
            const aiSections = await hydrateAiTasteSections(langPipe || 'hi|en', forceAiRefresh);
            for (const aiSec of aiSections) {
                sections.push(aiSec);
            }

            // 3. Curated For Your Taste (Movies) + Series + Upcoming in Your Languages + Quick Watch
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

            const [curatedMoviesRes, curatedTvRes, upcomingRes] = await Promise.all([
                firstValueFrom(discoverService.discoverMovies(curatedMoviesParams)),
                firstValueFrom(discoverService.discoverTv(curatedTvParams)),
                firstValueFrom(discoverService.discoverMovies(upcomingLangParams))
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

            // 4. Selected Cinema Vibes & Moods (Deterministic TMDB Discover Rules)
            const vibeFetches = selectedVibes.slice(0, 4).map(async (vibe) => {
                try {
                    const vibeParams: TmdbDiscoverMovieParamsDto = {
                        ...vibe.movieParams,
                        with_original_language: langPipe || 'hi|en'
                    };
                    const res = await firstValueFrom(discoverService.discoverMovies(vibeParams));
                    const items = filterWatched(mapMoviesToSwimlane(res.results || []));
                    if (items.length > 0) {
                        return {
                            id: `vibe-${vibe.key}`,
                            title: vibe.swimlaneTitle,
                            items,
                            queryContext: { type: 'discover_movies', movieParams: vibeParams }
                        } as DiscoverSwimlaneSection;
                    }
                } catch {
                    // Ignore failed vibe fetch
                }
                return null;
            });

            // 5. Individual Selected Official Genre Lanes
            const genreFetches = selectedGenres.slice(0, 4).map(async (genre) => {
                try {
                    const genreParams: TmdbDiscoverMovieParamsDto = {
                        with_original_language: langPipe || 'hi|en',
                        with_genres: genre.movieGenreIds,
                        'vote_average.gte': 6.7,
                        'vote_count.gte': 25,
                        sort_by: 'popularity.desc'
                    };
                    const res = await firstValueFrom(discoverService.discoverMovies(genreParams));
                    const items = filterWatched(mapMoviesToSwimlane(res.results || []));
                    if (items.length > 0) {
                        return {
                            id: `genre-${genre.key}`,
                            title: `TOP ${genre.label.toUpperCase()} IN YOUR LANGUAGES`,
                            items,
                            queryContext: { type: 'discover_movies', movieParams: genreParams }
                        } as DiscoverSwimlaneSection;
                    }
                } catch {
                    // Ignore failed genre fetch
                }
                return null;
            });

            const [resolvedVibes, resolvedGenres] = await Promise.all([
                Promise.all(vibeFetches),
                Promise.all(genreFetches)
            ]);

            for (const vSec of resolvedVibes) {
                if (vSec) sections.push(vSec);
            }
            for (const gSec of resolvedGenres) {
                if (gSec) sections.push(gSec);
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

        async refreshAiTasteNow(): Promise<void> {
            if (store.isAiTasteSyncing()) return;
            patchState(store, { isForYouLoading: true });
            try {
                const sections = await buildPersonalizedTopLanes(true);
                patchState(store, {
                    forYouSections: sections,
                    trendingPersonalizedSections: sections.slice(0, 3),
                    isForYouLoading: false
                });
            } catch (error) {
                console.error('Failed to refresh AI Taste lanes', error);
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

        async selectSpotlightStar(personId: number): Promise<void> {
            if (!personId || Number.isNaN(personId)) return;
            patchState(store, {
                spotlightStarId: personId,
                isSpotlightStarLoading: true
            });

            try {
                // Determine whether person is primarily a director or an actor to avoid irrelevant cameo/soundtrack matches
                const allPool = [
                    ...store.trendingActors(),
                    ...store.indianActors(),
                    ...store.worldActors(),
                    ...store.visionaryDirectors()
                ];
                const matchedPerson = allPool.find((p) => Number(p.id) === personId);
                const isDirector = matchedPerson?.payload?.['known_for_department'] === 'Directing';

                const primaryParam = isDirector
                    ? { with_crew: String(personId) }
                    : { with_cast: String(personId) };

                let [criticsRes, popularRes] = await Promise.all([
                    firstValueFrom(
                        discoverService.discoverMovies({
                            ...primaryParam,
                            sort_by: 'vote_average.desc',
                            'vote_count.gte': 25
                        })
                    ),
                    firstValueFrom(
                        discoverService.discoverMovies({
                            ...primaryParam,
                            sort_by: 'popularity.desc'
                        })
                    )
                ]);

                // Fallback to with_people only if with_cast/with_crew returned no results
                if ((criticsRes.results || []).length === 0 && (popularRes.results || []).length === 0) {
                    [criticsRes, popularRes] = await Promise.all([
                        firstValueFrom(
                            discoverService.discoverMovies({
                                with_people: String(personId),
                                sort_by: 'vote_average.desc',
                                'vote_count.gte': 20
                            })
                        ),
                        firstValueFrom(
                            discoverService.discoverMovies({
                                with_people: String(personId),
                                sort_by: 'popularity.desc'
                            })
                        )
                    ]);
                }

                const criticsItems = filterWatched(mapMoviesToSwimlane(criticsRes.results || []));
                const criticsIds = new Set(criticsItems.slice(0, 6).map((m) => m.id));
                const popularRaw = filterWatched(mapMoviesToSwimlane(popularRes.results || []));
                const popularDeduped = popularRaw.filter((m) => !criticsIds.has(m.id));

                if (store.spotlightStarId() === personId) {
                    patchState(store, {
                        spotlightStarCriticalMovies: criticsItems.length >= 3 ? criticsItems : popularRaw,
                        spotlightStarPopularMovies: popularDeduped.length >= 4 ? popularDeduped : popularRaw,
                        isSpotlightStarLoading: false
                    });
                }
            } catch (err) {
                console.warn('Failed to load spotlight star filmography', err);
                if (store.spotlightStarId() === personId) {
                    patchState(store, { isSpotlightStarLoading: false });
                }
            }
        },

        async refreshFavoriteStarMovies(): Promise<void> {
            const favDocs = storage.favoritePeople();
            if (favDocs.length === 0) {
                patchState(store, { favoriteStarMovies: [] });
                return;
            }
            const topFavIds = favDocs.slice(0, 5).map((d) => d.tmdbId).filter(Boolean);
            if (topFavIds.length === 0) return;

            try {
                const res = await firstValueFrom(
                    discoverService.discoverMovies({
                        with_people: topFavIds.join('|'),
                        sort_by: 'vote_average.desc',
                        'vote_count.gte': 30
                    })
                );
                // Always filter out already watched titles for the "Unwatched Gems" row
                const unwatched = mapMoviesToSwimlane(res.results || []).filter(
                    (item) => storage.getBookmarkState(item.id, 'movie') !== 'watched'
                );
                patchState(store, { favoriteStarMovies: unwatched });
            } catch (err) {
                console.warn('Failed to refresh favorite star movies', err);
            }
        },

        async loadActorsData(force = false): Promise<void> {
            if (!force && (store.trendingActors().length > 0 || store.isActorsLoading())) {
                void this.refreshFavoriteStarMovies();
                return;
            }
            patchState(store, { isActorsLoading: true });
            try {
                const prefLangs = discoverPrefs.preferredLanguages();
                const indianLangCodes = ['hi', 'ta', 'te', 'ml', 'kn', 'pa', 'mr', 'bn', 'gu'];
                const userIndianLangs = prefLangs.filter((l) => indianLangCodes.includes(l));
                const indianLangQuery = userIndianLangs.length > 0 ? userIndianLangs.join('|') : 'hi|ta|te|ml';

                const worldLangCodes = prefLangs.filter((l) => !indianLangCodes.includes(l) && l !== 'en');
                const worldLangQuery = worldLangCodes.length > 0 ? worldLangCodes.join('|') : 'ko|ja|es|fr';

                const [
                    trendingRes,
                    popularPage1,
                    popularPage2,
                    indianPopularMoviesRes,
                    indianAcclaimedMoviesRes,
                    worldMoviesRes
                ] = await Promise.all([
                    firstValueFrom(trendingService.getTrendingPeople('week')),
                    firstValueFrom(peopleService.getPopularPeople('en-US', 1)),
                    firstValueFrom(peopleService.getPopularPeople('en-US', 2)),
                    firstValueFrom(
                        discoverService.discoverMovies({
                            with_original_language: indianLangQuery,
                            sort_by: 'popularity.desc',
                            'vote_count.gte': 35
                        })
                    ),
                    firstValueFrom(
                        discoverService.discoverMovies({
                            with_origin_country: 'IN',
                            with_original_language: indianLangQuery,
                            sort_by: 'vote_average.desc',
                            'vote_count.gte': 80
                        })
                    ),
                    firstValueFrom(
                        discoverService.discoverMovies({
                            with_original_language: worldLangQuery,
                            sort_by: 'popularity.desc',
                            'vote_count.gte': 90
                        })
                    )
                ]);

                // Extract real Indian Stars & Directors from top Indian movies with strict language validation
                const indianLangSet = new Set(['hi', 'ta', 'te', 'ml', 'kn', 'pa', 'mr', 'bn', 'gu', 'or', 'as', 'ur']);
                const indianMovieSamples = [
                    ...(indianPopularMoviesRes.results || []),
                    ...(indianAcclaimedMoviesRes.results || [])
                ].filter((m) => m.original_language && indianLangSet.has(m.original_language));
                const uniqueIndianMovieMap = new Map<number, TmdbMovieListItemDto>();
                for (const m of indianMovieSamples) {
                    if (m.id && !uniqueIndianMovieMap.has(m.id)) {
                        uniqueIndianMovieMap.set(m.id, m);
                    }
                }
                const indianMoviesToInspect = [...uniqueIndianMovieMap.values()].slice(0, 6);

                const worldMoviesToInspect = (worldMoviesRes.results || []).slice(0, 5);

                const [indianCreditsList, worldCreditsList] = await Promise.all([
                    Promise.all(
                        indianMoviesToInspect.map((m) =>
                            firstValueFrom(moviesService.getMovieCredits(m.id)).then((credits) => ({
                                movieTitle: m.title,
                                credits
                            })).catch(() => null)
                        )
                    ),
                    Promise.all(
                        worldMoviesToInspect.map((m) =>
                            firstValueFrom(moviesService.getMovieCredits(m.id)).then((credits) => ({
                                movieTitle: m.title,
                                credits
                            })).catch(() => null)
                        )
                    )
                ]);

                const indianActorsMap = new Map<number, { item: SwimlaneItem; titles: Set<string>; score: number }>();
                const worldActorsMap = new Map<number, { item: SwimlaneItem; titles: Set<string>; score: number }>();
                const directorsMap = new Map<number, { item: SwimlaneItem; titles: Set<string>; score: number }>();

                // Seed directors from trending & popular people first
                for (const p of [...(trendingRes.results || []), ...(popularPage1.results || []), ...(popularPage2.results || [])]) {
                    if (p.profile_path && /directing/i.test(p.known_for_department || '')) {
                        const knownTitles = (p.known_for ?? [])
                            .map((k) => ('title' in k ? k.title : k.name))
                            .filter((t): t is string => Boolean(t))
                            .slice(0, 2);
                        directorsMap.set(p.id, {
                            item: {
                                id: p.id,
                                mediaType: 'person',
                                title: p.name,
                                subtitle: knownTitles.join(', ') || 'Directing',
                                posterUrl: resolveMediaImageUrl(p.profile_path, 'w500'),
                                bookmarkState: 'none',
                                payload: {
                                    ...p,
                                    known_for_department: 'Directing'
                                }
                            },
                            titles: new Set(knownTitles),
                            score: (p.popularity || 10) + 25
                        });
                    }
                }

                // Process Indian movie credits -> Indian Stars & Directors
                for (const entry of indianCreditsList) {
                    if (!entry?.credits) continue;
                    const { movieTitle, credits } = entry;
                    for (const castMember of (credits.cast || []).slice(0, 5)) {
                        if (!castMember.profile_path || !castMember.id) continue;
                        const existing = indianActorsMap.get(castMember.id);
                        if (existing) {
                            existing.titles.add(movieTitle);
                            existing.score += (castMember.popularity || 5) + 15;
                            existing.item.subtitle = [...existing.titles].slice(0, 2).join(', ');
                        } else {
                            indianActorsMap.set(castMember.id, {
                                item: {
                                    id: castMember.id,
                                    mediaType: 'person',
                                    title: castMember.name,
                                    subtitle: movieTitle,
                                    posterUrl: resolveMediaImageUrl(castMember.profile_path, 'w500'),
                                    bookmarkState: 'none',
                                    payload: {
                                        id: castMember.id,
                                        name: castMember.name,
                                        profile_path: castMember.profile_path,
                                        known_for_department: castMember.known_for_department || 'Acting',
                                        popularity: castMember.popularity
                                    }
                                },
                                titles: new Set([movieTitle]),
                                score: (castMember.popularity || 5) + Math.max(0, 10 - (castMember.order || 0))
                            });
                        }
                    }

                    for (const crewMember of credits.crew || []) {
                        if (crewMember.job !== 'Director' || !crewMember.profile_path || !crewMember.id) continue;
                        const existing = directorsMap.get(crewMember.id);
                        if (existing) {
                            existing.titles.add(movieTitle);
                            existing.score += (crewMember.popularity || 5) + 12;
                            existing.item.subtitle = [...existing.titles].slice(0, 2).join(', ');
                        } else {
                            directorsMap.set(crewMember.id, {
                                item: {
                                    id: crewMember.id,
                                    mediaType: 'person',
                                    title: crewMember.name,
                                    subtitle: movieTitle,
                                    posterUrl: resolveMediaImageUrl(crewMember.profile_path, 'w500'),
                                    bookmarkState: 'none',
                                    payload: {
                                        id: crewMember.id,
                                        name: crewMember.name,
                                        profile_path: crewMember.profile_path,
                                        known_for_department: 'Directing',
                                        popularity: crewMember.popularity
                                    }
                                },
                                titles: new Set([movieTitle]),
                                score: (crewMember.popularity || 5) + 12
                            });
                        }
                    }
                }

                // Process World/Asian movie credits -> World Stars & Directors
                for (const entry of worldCreditsList) {
                    if (!entry?.credits) continue;
                    const { movieTitle, credits } = entry;
                    for (const castMember of (credits.cast || []).slice(0, 4)) {
                        if (!castMember.profile_path || !castMember.id) continue;
                        const existing = worldActorsMap.get(castMember.id);
                        if (existing) {
                            existing.titles.add(movieTitle);
                            existing.score += (castMember.popularity || 5) + 15;
                            existing.item.subtitle = [...existing.titles].slice(0, 2).join(', ');
                        } else {
                            worldActorsMap.set(castMember.id, {
                                item: {
                                    id: castMember.id,
                                    mediaType: 'person',
                                    title: castMember.name,
                                    subtitle: movieTitle,
                                    posterUrl: resolveMediaImageUrl(castMember.profile_path, 'w500'),
                                    bookmarkState: 'none',
                                    payload: {
                                        id: castMember.id,
                                        name: castMember.name,
                                        profile_path: castMember.profile_path,
                                        known_for_department: castMember.known_for_department || 'Acting',
                                        popularity: castMember.popularity
                                    }
                                },
                                titles: new Set([movieTitle]),
                                score: (castMember.popularity || 5) + Math.max(0, 10 - (castMember.order || 0))
                            });
                        }
                    }

                    for (const crewMember of credits.crew || []) {
                        if (crewMember.job !== 'Director' || !crewMember.profile_path || !crewMember.id) continue;
                        const existing = directorsMap.get(crewMember.id);
                        if (existing) {
                            existing.titles.add(movieTitle);
                            existing.score += (crewMember.popularity || 5) + 12;
                            existing.item.subtitle = [...existing.titles].slice(0, 2).join(', ');
                        } else {
                            directorsMap.set(crewMember.id, {
                                item: {
                                    id: crewMember.id,
                                    mediaType: 'person',
                                    title: crewMember.name,
                                    subtitle: movieTitle,
                                    posterUrl: resolveMediaImageUrl(crewMember.profile_path, 'w500'),
                                    bookmarkState: 'none',
                                    payload: {
                                        id: crewMember.id,
                                        name: crewMember.name,
                                        profile_path: crewMember.profile_path,
                                        known_for_department: 'Directing',
                                        popularity: crewMember.popularity
                                    }
                                },
                                titles: new Set([movieTitle]),
                                score: (crewMember.popularity || 5) + 10
                            });
                        }
                    }
                }

                const trendingIds = new Set((trendingRes.results || []).map((p) => p.id));
                const filteredPopular = (popularPage1.results || []).filter((p) => !trendingIds.has(p.id));

                const trendingActors = mapPeopleToSwimlane(trendingRes.results || []);
                const indianActors = [...indianActorsMap.values()]
                    .sort((a, b) => b.score - a.score)
                    .map((e) => e.item);
                const popularActors = mapPeopleToSwimlane(
                    filteredPopular.length >= 6 ? filteredPopular : (popularPage1.results || [])
                );
                const worldActors = [...worldActorsMap.values()]
                    .sort((a, b) => b.score - a.score)
                    .map((e) => e.item);
                const visionaryDirectors = [...directorsMap.values()]
                    .sort((a, b) => b.score - a.score)
                    .map((e) => e.item);
                const breakoutActors = mapPeopleToSwimlane(popularPage2.results || []);

                patchState(store, {
                    trendingActors,
                    indianActors,
                    popularActors,
                    worldActors,
                    visionaryDirectors,
                    breakoutActors,
                    isActorsLoading: false
                });

                void this.refreshFavoriteStarMovies();

                // Auto-select initial spotlight star if none is active
                if (!store.spotlightStarId()) {
                    const favFirst = storage.favoritePeople()[0]?.tmdbId;
                    const fallbackFirst = Number(indianActors[0]?.id || trendingActors[0]?.id || popularActors[0]?.id || 0);
                    const initialStarId = favFirst || fallbackFirst;
                    if (initialStarId > 0) {
                        void this.selectSpotlightStar(initialStarId);
                    }
                }
            } catch (error) {
                console.error('Failed to load Trending Actors', error);
                patchState(store, { isActorsLoading: false });
            }
        }
        };
    })
);
