import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbTrendingMixedItemDto } from '../dtos/trending/trending-mixed-item.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { HeroBannerItem } from '../../shared/models/hero-banner-item.interface';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';

interface TrendingState {
    heroItems: HeroBannerItem[];
    movies: SwimlaneItem[];
    tvShows: SwimlaneItem[];
    isLoading: boolean;
    error: string | null;
}

const initialState: TrendingState = {
    heroItems: [],
    movies: [],
    tvShows: [],
    isLoading: false,
    error: null,
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

function mapToHeroItems(items: TmdbTrendingMixedItemDto[]): HeroBannerItem[] {
    const heroItems: HeroBannerItem[] = [];

    for (const item of items) {
        // 1. If it's a person or has no backdrop, skip it immediately.
        if (item.media_type === 'person' || !item.backdrop_path) {
            continue;
        }

        console.log(item);

        // 2. TypeScript now strictly knows 'item' is a Movie or a TV Show!
        // No compiler errors here.
        heroItems.push({
            id: item.id,
            title: item.media_type === 'movie' ? item.title : item.name,
            overview: item.overview,
            backdropUrl: `${TMDB_IMAGE_BASE}w1280${item.backdrop_path}`,
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'NR',
        });

        // 3. Stop processing once we have our top 5 for the Swiper
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
            title: item.title,
            posterUrl: `${TMDB_IMAGE_BASE}w500${item.poster_path}`,
            bookmarkState: 'none',
        }));
}

function mapTvToSwimlane(items: TmdbTvListItemDto[]): SwimlaneItem[] {
    return items
        .filter((item) => item.poster_path)
        .map((item) => ({
            id: item.id,
            title: item.name,
            posterUrl: `${TMDB_IMAGE_BASE}w500${item.poster_path}`,
            bookmarkState: 'none',
        }));
}

export const TrendingStore = signalStore(
    withState(initialState),
    withMethods((store, trendingService = inject(TmdbTrendingService)) => ({

        async loadTrendingData(): Promise<void> {
            patchState(store, { isLoading: true, error: null });

            try {
                // NEW: Smart Pulse Logic
                // 0 = Sunday, 5 = Friday, 6 = Saturday
                const today = new Date().getDay();
                const isWeekend = today === 0 || today === 5 || today === 6;
                const pulseWindow = isWeekend ? 'week' : 'day';

                // Fire all 3 API calls in parallel, using the dynamic pulseWindow
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
        }
    }))
);