import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { HeroBannerItem } from '../../shared/models/hero-banner-item.interface';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';

interface TvState {
    heroItems: HeroBannerItem[];
    popular: SwimlaneItem[];
    animation: SwimlaneItem[];
    drama: SwimlaneItem[];
    mystery: SwimlaneItem[];
    isLoading: boolean;
    error: string | null;
}

const initialState: TvState = {
    heroItems: [],
    popular: [],
    animation: [],
    drama: [],
    mystery: [],
    isLoading: false,
    error: null,
};

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

function mapToHeroItems(items: TmdbTvListItemDto[]): HeroBannerItem[] {
    return items
        .filter(item => item.backdrop_path)
        .slice(0, 5)
        .map(item => ({
            id: item.id,
            title: item.name,
            overview: item.overview,
            backdropUrl: `${TMDB_IMAGE_BASE}w1280${item.backdrop_path}`,
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'NR',
        }));
}

function mapToSwimlane(items: TmdbTvListItemDto[]): SwimlaneItem[] {
    return items
        .filter(item => item.poster_path)
        .map(item => ({
            id: item.id,
            title: item.name,
            posterUrl: `${TMDB_IMAGE_BASE}w500${item.poster_path}`,
            bookmarkState: 'none',
        }));
}

export const TvStore = signalStore(
    withState(initialState),
    withMethods((
        store,
        discoverService = inject(TmdbDiscoverService),
        trendingService = inject(TmdbTrendingService)
    ) => ({
        async loadTvData(): Promise<void> {
            if (store.isLoading()) return;

            patchState(store, { isLoading: true, error: null });

            try {
                const [trendingRes, popularRes, animationRes, dramaRes, mysteryRes] = await Promise.all([
                    firstValueFrom(trendingService.getTrendingTvShows('day')),
                    firstValueFrom(discoverService.discoverTv({ sort_by: 'popularity.desc' })),
                    firstValueFrom(discoverService.discoverTv({ with_genres: '16' })), // Animation
                    firstValueFrom(discoverService.discoverTv({ with_genres: '18' })), // Drama
                    firstValueFrom(discoverService.discoverTv({ with_genres: '9648' })) // Mystery
                ]);

                patchState(store, {
                    heroItems: mapToHeroItems(trendingRes.results),
                    popular: mapToSwimlane(popularRes.results),
                    animation: mapToSwimlane(animationRes.results),
                    drama: mapToSwimlane(dramaRes.results),
                    mystery: mapToSwimlane(mysteryRes.results),
                    isLoading: false
                });

            } catch (error) {
                console.error('Failed to load TV data', error);
                patchState(store, { isLoading: false, error: 'Failed to load TV shows.' });
            }
        }
    }))
);
