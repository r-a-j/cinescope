import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { HeroBannerItem } from '../../shared/models/hero-banner-item.interface';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';

interface MoviesState {
    heroItems: HeroBannerItem[];
    popular: SwimlaneItem[];
    action: SwimlaneItem[];
    comedy: SwimlaneItem[];
    sciFi: SwimlaneItem[];
    isLoading: boolean;
    error: string | null;
}

const initialState: MoviesState = {
    heroItems: [],
    popular: [],
    action: [],
    comedy: [],
    sciFi: [],
    isLoading: false,
    error: null,
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

function mapToHeroItems(items: TmdbMovieListItemDto[]): HeroBannerItem[] {
    return items
        .filter(item => item.backdrop_path)
        .slice(0, 5)
        .map(item => ({
            id: item.id,
            title: item.title,
            overview: item.overview,
            backdropUrl: `${TMDB_IMAGE_BASE}w1280${item.backdrop_path}`,
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'NR',
        }));
}

function mapToSwimlane(items: TmdbMovieListItemDto[]): SwimlaneItem[] {
    return items
        .filter(item => item.poster_path)
        .map(item => ({
            id: item.id,
            title: item.title,
            posterUrl: `${TMDB_IMAGE_BASE}w500${item.poster_path}`,
            bookmarkState: 'none',
        }));
}

export const MoviesStore = signalStore(
    withState(initialState),
    withMethods((
        store,
        discoverService = inject(TmdbDiscoverService),
        trendingService = inject(TmdbTrendingService)
    ) => ({
        async loadMoviesData(): Promise<void> {
            if (store.isLoading()) return;

            patchState(store, { isLoading: true, error: null });

            try {
                const [trendingRes, popularRes, actionRes, comedyRes, sciFiRes] = await Promise.all([
                    firstValueFrom(trendingService.getTrendingMovies('day')),
                    firstValueFrom(discoverService.discoverMovies({ sort_by: 'popularity.desc' })),
                    firstValueFrom(discoverService.discoverMovies({ with_genres: '28' })), // Action
                    firstValueFrom(discoverService.discoverMovies({ with_genres: '35' })), // Comedy
                    firstValueFrom(discoverService.discoverMovies({ with_genres: '878' })) // Sci-Fi
                ]);

                patchState(store, {
                    heroItems: mapToHeroItems(trendingRes.results),
                    popular: mapToSwimlane(popularRes.results),
                    action: mapToSwimlane(actionRes.results),
                    comedy: mapToSwimlane(comedyRes.results),
                    sciFi: mapToSwimlane(sciFiRes.results),
                    isLoading: false
                });

            } catch (error) {
                console.error('Failed to load movies data', error);
                patchState(store, { isLoading: false, error: 'Failed to load movies.' });
            }
        }
    }))
);
