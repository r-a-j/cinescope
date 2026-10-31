import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TmdbTrendingService } from './tmdb-trending.service';
import { TmdbDiscoverService } from './tmdb-discover.service';
import { TmdbMoviesService } from './tmdb-movies.service';
import { TmdbTvService } from './tmdb-tv.service';
import { TmdbPeopleService } from './tmdb-people.service';
import { TmdbCollectionsService } from './tmdb-collections.service';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { resolveMediaImageUrl } from '../constants/api.constants';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { TmdbPersonListItemDto } from '../dtos/people/person-list-item.dto';
import { TmdbDiscoverMovieParamsDto } from '../dtos/discover/discover-movie-params.dto';
import { TmdbDiscoverTvParamsDto } from '../dtos/discover/discover-tv-params.dto';
import { StorageService } from './storage.service';
import { DiscoverPreferencesService } from './discover-preferences.service';

export type CollectionSortMode = 'featured' | 'rating' | 'newest' | 'alpha';

export interface CollectionFilterOptions {
  minRating: number | null;
  recentOnly: boolean;
  highVotesOnly: boolean;
  genres: string[];
}

export const GENRE_MAP: Record<string, { movie: number; tv: number; label: string }> = {
  action: { movie: 28, tv: 10759, label: 'Action' },
  comedy: { movie: 35, tv: 35, label: 'Comedy' },
  drama: { movie: 18, tv: 18, label: 'Drama' },
  thriller: { movie: 53, tv: 80, label: 'Thriller' },
  scifi: { movie: 878, tv: 10765, label: 'Sci-Fi' },
  romance: { movie: 10749, tv: 10766, label: 'Romance' }
};

export interface CollectionQueryContext {
  type?: string;
  id?: number;
  mediaType?: 'movie' | 'tv';
  movieParams?: TmdbDiscoverMovieParamsDto;
  tvParams?: TmdbDiscoverTvParamsDto;
  region?: string;
}

export interface CollectionPageResult {
  items: SwimlaneItem[];
  hasMore: boolean;
}

type MovieSortBy = NonNullable<TmdbDiscoverMovieParamsDto['sort_by']>;
type TvSortBy = NonNullable<TmdbDiscoverTvParamsDto['sort_by']>;

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

function mapPeopleToSwimlane(items: TmdbPersonListItemDto[]): SwimlaneItem[] {
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

function getDiscoverSortBy(mode: CollectionSortMode, defaultSort: MovieSortBy = 'popularity.desc'): MovieSortBy {
  if (mode === 'rating') return 'vote_average.desc';
  if (mode === 'newest') return 'primary_release_date.desc';
  if (mode === 'alpha') return 'title.asc';
  return defaultSort;
}

function getDiscoverTvSortBy(mode: CollectionSortMode, defaultSort: TvSortBy = 'popularity.desc'): TvSortBy {
  if (mode === 'rating') return 'vote_average.desc';
  if (mode === 'newest') return 'first_air_date.desc';
  if (mode === 'alpha') return 'name.asc';
  return defaultSort;
}

function applyFiltersToMovieParams(params: TmdbDiscoverMovieParamsDto, filters?: CollectionFilterOptions): void {
  if (!filters) return;
  if (filters.minRating !== null && filters.minRating !== undefined) {
    params['vote_average.gte'] = filters.minRating;
    params['vote_count.gte'] = Math.max(params['vote_count.gte'] || 20, 20);
  }
  if (filters.recentOnly) {
    params['primary_release_date.gte'] = '2023-01-01';
  }
  if (filters.highVotesOnly) {
    params['vote_count.gte'] = 100;
  }
  if (filters.genres && filters.genres.length > 0) {
    const movieGenreIds = filters.genres.map((k) => GENRE_MAP[k]?.movie).filter(Boolean);
    if (movieGenreIds.length > 0) {
      params.with_genres = movieGenreIds.join('|');
    }
  }
}

function applyFiltersToTvParams(params: TmdbDiscoverTvParamsDto, filters?: CollectionFilterOptions): void {
  if (!filters) return;
  if (filters.minRating !== null && filters.minRating !== undefined) {
    params['vote_average.gte'] = filters.minRating;
    params['vote_count.gte'] = Math.max(params['vote_count.gte'] || 15, 15);
  }
  if (filters.recentOnly) {
    params['first_air_date.gte'] = '2023-01-01';
  }
  if (filters.highVotesOnly) {
    params['vote_count.gte'] = 80;
  }
  if (filters.genres && filters.genres.length > 0) {
    const tvGenreIds = filters.genres.map((k) => GENRE_MAP[k]?.tv).filter(Boolean);
    if (tvGenreIds.length > 0) {
      params.with_genres = tvGenreIds.join('|');
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class CollectionLoaderService {
  private trendingService = inject(TmdbTrendingService);
  private discoverService = inject(TmdbDiscoverService);
  private moviesService = inject(TmdbMoviesService);
  private tvService = inject(TmdbTvService);
  private peopleService = inject(TmdbPeopleService);
  private collectionsService = inject(TmdbCollectionsService);
  private storageService = inject(StorageService);
  private discoverPrefs = inject(DiscoverPreferencesService);

  private filterWatched(items: SwimlaneItem[], skipFilter = false): SwimlaneItem[] {
    if (skipFilter || !this.discoverPrefs.hideWatchedInDiscover()) {
      return items;
    }
    return items.filter((item) => {
      if (item.mediaType !== 'movie' && item.mediaType !== 'tv') return true;
      return this.storageService.getBookmarkState(item.id, item.mediaType) !== 'watched';
    });
  }

  public isServerSortable(title: string, context?: CollectionQueryContext): boolean {
    if (
      context?.type === 'person_credits' ||
      context?.type === 'discover_movies' ||
      context?.type === 'discover_tv'
    ) {
      return true;
    }
    const t = title.toUpperCase().trim();
    return [
      'INDIAN OTT & WEB SERIES',
      'TELUGU BLOCKBUSTERS',
      'TAMIL CINEMA PULSE',
      'MALAYALAM CRITICS\' GEMS',
      'NEW IN BOLLYWOOD',
      'TRENDING IN BOLLYWOOD',
      'CRITICS\' CHOICE HINDI CLASSICS',
      'MODERN MASTERPIECES (2020S)',
      'TOP RATED INDIAN CINEMA'
    ].includes(t);
  }

  public async fetchPage(
    title: string,
    page: number,
    sortMode: CollectionSortMode = 'featured',
    context?: CollectionQueryContext,
    filters?: CollectionFilterOptions
  ): Promise<CollectionPageResult> {
    const t = title.toUpperCase().trim();
    const today = new Date().getDay();
    const isWeekend = today === 0 || today === 5 || today === 6;
    const pulseWindow = isWeekend ? 'week' : 'day';
    const todayIso = new Date().toISOString().slice(0, 10);
    const activeRegion = context?.region || this.storageService.userRegion() || 'IN';

    // Generic Discover Movies Context
    if (context?.type === 'discover_movies' && context.movieParams) {
      const baseSort = context.movieParams.sort_by || 'popularity.desc';
      const sortBy = getDiscoverSortBy(sortMode, baseSort);
      const movieParams: TmdbDiscoverMovieParamsDto = {
        ...context.movieParams,
        sort_by: sortBy,
        page
      };
      applyFiltersToMovieParams(movieParams, filters);
      const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
      return {
        items: this.filterWatched(mapMoviesToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    // Generic Discover TV Context
    if (context?.type === 'discover_tv' && context.tvParams) {
      const baseSort = context.tvParams.sort_by || 'popularity.desc';
      const sortBy = getDiscoverTvSortBy(sortMode, baseSort);
      const tvParams: TmdbDiscoverTvParamsDto = {
        ...context.tvParams,
        sort_by: sortBy,
        page
      };
      applyFiltersToTvParams(tvParams, filters);
      const res = await firstValueFrom(this.discoverService.discoverTv(tvParams));
      return {
        items: this.filterWatched(mapTvToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    // Structured Endpoint Contexts
    if (context?.type === 'trending_movies') {
      const res = await firstValueFrom(this.trendingService.getTrendingMovies(pulseWindow, 'en-US', page));
      return {
        items: this.filterWatched(mapMoviesToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    if (context?.type === 'trending_tv') {
      const res = await firstValueFrom(this.trendingService.getTrendingTvShows(pulseWindow, 'en-US', page));
      return {
        items: this.filterWatched(mapTvToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    if (context?.type === 'now_playing') {
      const res = await firstValueFrom(this.moviesService.getNowPlayingMovies('en-US', page, activeRegion));
      return {
        items: this.filterWatched(mapMoviesToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    if (context?.type === 'upcoming') {
      const res = await firstValueFrom(this.moviesService.getUpcomingMovies('en-US', page, activeRegion));
      return {
        items: this.filterWatched(mapMoviesToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    if (context?.type === 'on_the_air') {
      const res = await firstValueFrom(this.tvService.getTvOnTheAir('en-US', page));
      return {
        items: this.filterWatched(mapTvToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    if (context?.type === 'top_rated_movies') {
      const res = await firstValueFrom(this.moviesService.getTopRatedMovies('en-US', page));
      return {
        items: this.filterWatched(mapMoviesToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    if (context?.type === 'top_rated_tv') {
      const res = await firstValueFrom(this.tvService.getTopRatedTvShows('en-US', page));
      return {
        items: this.filterWatched(mapTvToSwimlane(res.results)),
        hasMore: res.page < res.total_pages
      };
    }

    if (context?.type === 'trending_people') {
      const res = await firstValueFrom(this.trendingService.getTrendingPeople('week', 'en-US', page));
      return { items: mapPeopleToSwimlane(res.results), hasMore: res.page < res.total_pages };
    }

    if (context?.type === 'popular_people') {
      const res = await firstValueFrom(this.peopleService.getPopularPeople('en-US', page));
      return { items: mapPeopleToSwimlane(res.results), hasMore: res.page < res.total_pages };
    }

    if (context?.type === 'breakout_people') {
      const res = await firstValueFrom(this.peopleService.getPopularPeople('en-US', page + 2));
      return { items: mapPeopleToSwimlane(res.results), hasMore: res.page < res.total_pages };
    }

    if (context?.type === 'indian_people' || context?.type === 'world_people' || context?.type === 'director_people') {
      const isIndian = context.type === 'indian_people';
      const isDirectors = context.type === 'director_people';
      const discoverRes = await firstValueFrom(
        this.discoverService.discoverMovies(
          isIndian
            ? { with_origin_country: 'IN', sort_by: 'popularity.desc', 'vote_count.gte': 30, page }
            : isDirectors
              ? { sort_by: 'vote_average.desc', 'vote_count.gte': 1200, page }
              : { with_original_language: 'ko|ja|es|fr', sort_by: 'popularity.desc', 'vote_count.gte': 80, page }
        )
      );
      const sampleMovies = (discoverRes.results || []).slice(0, 5);
      const creditsList = await Promise.all(
        sampleMovies.map((m) =>
          firstValueFrom(this.moviesService.getMovieCredits(m.id))
            .then((credits) => ({ movieTitle: m.title, credits }))
            .catch(() => null)
        )
      );
      const peopleMap = new Map<number, SwimlaneItem>();
      for (const entry of creditsList) {
        if (!entry?.credits) continue;
        if (isDirectors) {
          for (const crew of entry.credits.crew || []) {
            if (crew.job === 'Director' && crew.profile_path && !peopleMap.has(crew.id)) {
              peopleMap.set(crew.id, {
                id: crew.id,
                mediaType: 'person',
                title: crew.name,
                subtitle: entry.movieTitle,
                posterUrl: resolveMediaImageUrl(crew.profile_path, 'w500'),
                bookmarkState: 'none',
                payload: {
                  id: crew.id,
                  name: crew.name,
                  profile_path: crew.profile_path,
                  known_for_department: 'Directing'
                }
              });
            }
          }
        } else {
          for (const cast of (entry.credits.cast || []).slice(0, 5)) {
            if (cast.profile_path && !peopleMap.has(cast.id)) {
              peopleMap.set(cast.id, {
                id: cast.id,
                mediaType: 'person',
                title: cast.name,
                subtitle: entry.movieTitle,
                posterUrl: resolveMediaImageUrl(cast.profile_path, 'w500'),
                bookmarkState: 'none',
                payload: {
                  id: cast.id,
                  name: cast.name,
                  profile_path: cast.profile_path,
                  known_for_department: cast.known_for_department || 'Acting'
                }
              });
            }
          }
        }
      }
      return {
        items: [...peopleMap.values()],
        hasMore: discoverRes.page < discoverRes.total_pages
      };
    }

    // Person Filmography Discover
    if (context?.type === 'person_credits' && context.id) {
      const sortBy = getDiscoverSortBy(sortMode, 'popularity.desc');
      const movieParams: TmdbDiscoverMovieParamsDto = {
        with_people: String(context.id),
        sort_by: sortBy,
        page
      };
      applyFiltersToMovieParams(movieParams, filters);
      const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
      return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
    }

    // Franchise Collection Handler
    if (context?.type === 'collection' && context.id) {
      const details = await firstValueFrom(this.collectionsService.getCollectionDetails(context.id));
      const parts = details.parts || [];
      const items: SwimlaneItem[] = parts.map((p) => ({
        id: p.id,
        mediaType: 'movie',
        title: p.title,
        posterUrl: resolveMediaImageUrl(p.poster_path, 'w500'),
        bookmarkState: 'none',
        payload: {
          ...p,
          collection_backdrop_path: details.backdrop_path,
          collection_overview: details.overview,
          collection_name: details.name
        }
      }));
      return { items, hasMore: false };
    }

    // Context-driven (Recommendations / Similar on Media Detail) with Smart Discover Fallback
    if ((context?.type === 'recommendations' || context?.type === 'similar') && context.id) {
      const isRecs = context.type === 'recommendations';
      if (context.mediaType === 'tv') {
        const res = await firstValueFrom(
          isRecs
            ? this.tvService.getTvRecommendations(context.id, 'en-US', page)
            : this.tvService.getSimilarTvShows(context.id, 'en-US', page)
        );
        let mapped = this.filterWatched(
          mapTvToSwimlane(res.results).filter((i) => i.id !== context.id)
        );
        let hasMore = res.page < res.total_pages;

        if (mapped.length < 6 && context.tvParams) {
          const fallbackParams: TmdbDiscoverTvParamsDto = {
            ...context.tvParams,
            page
          };
          applyFiltersToTvParams(fallbackParams, filters);
          const fallbackRes = await firstValueFrom(this.discoverService.discoverTv(fallbackParams));
          const fallbackItems = this.filterWatched(
            mapTvToSwimlane(fallbackRes.results).filter((i) => i.id !== context.id)
          );
          const seen = new Set(mapped.map((i) => i.id));
          mapped = [...mapped, ...fallbackItems.filter((i) => !seen.has(i.id))];
          hasMore = hasMore || fallbackRes.page < fallbackRes.total_pages;
        }
        return { items: mapped, hasMore };
      } else {
        const res = await firstValueFrom(
          isRecs
            ? this.moviesService.getMovieRecommendations(context.id, 'en-US', page)
            : this.moviesService.getSimilarMovies(context.id, 'en-US', page)
        );
        let mapped = this.filterWatched(
          mapMoviesToSwimlane(res.results).filter((i) => i.id !== context.id)
        );
        let hasMore = res.page < res.total_pages;

        if (mapped.length < 6 && context.movieParams) {
          const fallbackParams: TmdbDiscoverMovieParamsDto = {
            ...context.movieParams,
            page
          };
          applyFiltersToMovieParams(fallbackParams, filters);
          const fallbackRes = await firstValueFrom(this.discoverService.discoverMovies(fallbackParams));
          const fallbackItems = this.filterWatched(
            mapMoviesToSwimlane(fallbackRes.results).filter((i) => i.id !== context.id)
          );
          const seen = new Set(mapped.map((i) => i.id));
          mapped = [...mapped, ...fallbackItems.filter((i) => !seen.has(i.id))];
          hasMore = hasMore || fallbackRes.page < fallbackRes.total_pages;
        }
        return { items: mapped, hasMore };
      }
    }

    // Discover Lane Collections
    switch (t) {
      case 'VIRAL MOVIES TODAY': {
        const res = await firstValueFrom(this.trendingService.getTrendingMovies(pulseWindow, 'en-US', page));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'IN THEATERS NOW': {
        const res = await firstValueFrom(this.moviesService.getNowPlayingMovies('en-US', page, 'IN'));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'BINGE-WORTHY SHOWS': {
        const res = await firstValueFrom(this.trendingService.getTrendingTvShows(pulseWindow, 'en-US', page));
        return { items: mapTvToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'AIRING THIS WEEK': {
        const res = await firstValueFrom(this.tvService.getTvOnTheAir('en-US', page));
        return { items: mapTvToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'INDIAN OTT & WEB SERIES': {
        const sortBy = getDiscoverTvSortBy(sortMode, 'popularity.desc');
        const tvParams: TmdbDiscoverTvParamsDto = {
          with_origin_country: 'IN',
          sort_by: sortBy,
          page
        };
        applyFiltersToTvParams(tvParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverTv(tvParams));
        return { items: mapTvToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'TELUGU BLOCKBUSTERS': {
        const sortBy = getDiscoverSortBy(sortMode, 'popularity.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          with_original_language: 'te',
          region: 'IN',
          sort_by: sortBy,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'TAMIL CINEMA PULSE': {
        const sortBy = getDiscoverSortBy(sortMode, 'popularity.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          with_original_language: 'ta',
          region: 'IN',
          sort_by: sortBy,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'MALAYALAM CRITICS\' GEMS': {
        const sortBy = getDiscoverSortBy(sortMode, 'vote_average.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          with_original_language: 'ml',
          sort_by: sortBy,
          'vote_count.gte': 35,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'NEW IN BOLLYWOOD': {
        const sortBy = getDiscoverSortBy(sortMode, 'primary_release_date.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          with_original_language: 'hi',
          'primary_release_date.lte': todayIso,
          sort_by: sortBy,
          'vote_count.gte': 5,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'TRENDING IN BOLLYWOOD': {
        const sortBy = getDiscoverSortBy(sortMode, 'popularity.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          with_original_language: 'hi',
          sort_by: sortBy,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'CRITICS\' CHOICE HINDI CLASSICS': {
        const sortBy = getDiscoverSortBy(sortMode, 'vote_average.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          with_original_language: 'hi',
          'primary_release_date.lte': '2015-12-31',
          sort_by: sortBy,
          'vote_count.gte': 30,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'MODERN MASTERPIECES (2020S)': {
        const sortBy = getDiscoverSortBy(sortMode, 'vote_average.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          'primary_release_date.gte': '2020-01-01',
          sort_by: sortBy,
          'vote_count.gte': 1000,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'ALL-TIME HALL OF FAME MOVIES': {
        const res = await firstValueFrom(this.moviesService.getTopRatedMovies('en-US', page));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'PRESTIGE TV VAULT': {
        const res = await firstValueFrom(this.tvService.getTopRatedTvShows('en-US', page));
        return { items: mapTvToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'TOP RATED INDIAN CINEMA': {
        const sortBy = getDiscoverSortBy(sortMode, 'vote_average.desc');
        const movieParams: TmdbDiscoverMovieParamsDto = {
          with_origin_country: 'IN',
          sort_by: sortBy,
          'vote_count.gte': 60,
          page
        };
        applyFiltersToMovieParams(movieParams, filters);
        const res = await firstValueFrom(this.discoverService.discoverMovies(movieParams));
        return { items: mapMoviesToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'TRENDING STARS THIS WEEK': {
        const res = await firstValueFrom(this.trendingService.getTrendingPeople('week', 'en-US', page));
        return { items: mapPeopleToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'POPULAR GLOBAL ICONS': {
        const res = await firstValueFrom(this.peopleService.getPopularPeople('en-US', page));
        return { items: mapPeopleToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      case 'BREAKOUT & FAN FAVORITES': {
        // Starts with offset page + 2 to show distinct breakout actors
        const res = await firstValueFrom(this.peopleService.getPopularPeople('en-US', page + 2));
        return { items: mapPeopleToSwimlane(res.results), hasMore: res.page < res.total_pages };
      }
      default: {
        return { items: [], hasMore: false };
      }
    }
  }
}
