import { RecommendationEngineService } from '../services/recommendation-engine.service';
import { TasteProfileService } from '../services/taste-profile.service';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { TrendingStore, getInitialTrendingState } from './trending.store';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';
import {
    DiscoverFeedCachePayload,
    STORAGE_KEY_DISCOVER_FEED_CACHE
} from '../services/discover-preferences.service';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';

describe('TrendingStore', () => {
    let response: Subject<{ results: never[] }>;
    let trendingService: {
        getTrendingAll: jasmine.Spy;
        getTrendingMovies: jasmine.Spy;
        getTrendingTvShows: jasmine.Spy;
    };
    let store: InstanceType<typeof TrendingStore>;

    beforeEach(() => {
        try {
            localStorage.removeItem(STORAGE_KEY_DISCOVER_FEED_CACHE);
            localStorage.removeItem('cinescope_ai_taste_cache_v2');
        } catch {
            // Ignore
        }

        response = new Subject<{ results: never[] }>();
        const observable = response.asObservable();
        trendingService = {
            getTrendingAll: jasmine.createSpy('getTrendingAll').and.returnValue(observable),
            getTrendingMovies: jasmine.createSpy('getTrendingMovies').and.returnValue(observable),
            getTrendingTvShows: jasmine.createSpy('getTrendingTvShows').and.returnValue(observable)
        };

        TestBed.configureTestingModule({
            providers: [
                TrendingStore,
                { provide: TmdbTrendingService, useValue: trendingService },
                { provide: TmdbDiscoverService, useValue: {} },
                { provide: RecommendationEngineService, useValue: null },
                { provide: TasteProfileService, useValue: null },
                { provide: TmdbMoviesService, useValue: { getNowPlayingMovies: jasmine.createSpy().and.returnValue(observable) } },
                { provide: TmdbTvService, useValue: { getTvOnTheAir: jasmine.createSpy().and.returnValue(observable) } },
                { provide: TmdbPeopleService, useValue: {} }
            ]
        });
        store = TestBed.inject(TrendingStore);
    });

    afterEach(() => {
        try {
            localStorage.removeItem(STORAGE_KEY_DISCOVER_FEED_CACHE);
            localStorage.removeItem('cinescope_ai_taste_cache_v2');
        } catch {
            // Ignore
        }
    });

    it('keeps concurrent callers waiting for the same initial feed request', async () => {
        const firstLoad = store.loadTrendingData();
        const secondLoad = store.loadTrendingData();
        let secondLoadCompleted = false;
        void secondLoad.then(() => {
            secondLoadCompleted = true;
        });

        await Promise.resolve();

        expect(secondLoadCompleted).toBeFalse();
        expect(trendingService.getTrendingAll).toHaveBeenCalledTimes(1);

        response.next({ results: [] });
        response.complete();
        await Promise.all([firstLoad, secondLoad]);

        expect(secondLoadCompleted).toBeTrue();
        expect(store.isLoading()).toBeFalse();
        expect(store.hasLoadedTrendingData()).toBeTrue();

        await store.loadTrendingData();
        expect(trendingService.getTrendingAll).toHaveBeenCalledTimes(1);
    });

    it('initializes store with empty personalized sections and no duplicates', () => {
        const sections = store.forYouSections();
        const seenKeys = new Set<string>();
        let duplicatesCount = 0;

        for (const sec of sections) {
            for (const item of sec.items) {
                const key = `${item.mediaType}_${item.id}`;
                if (seenKeys.has(key)) {
                    duplicatesCount++;
                }
                seenKeys.add(key);
            }
        }

        expect(duplicatesCount).toBe(0);
    });

    it('initializes store state synchronously from valid 12-hour discover feed cache', () => {
        const mockCache: DiscoverFeedCachePayload = {
            generatedAt: Date.now(),
            expiresAt: Date.now() + 12 * 60 * 60 * 1000,
            heroItems: [{
                id: 101,
                mediaType: 'movie',
                title: 'Cached Hero',
                overview: 'Hero overview',
                backdropUrl: '/hero.jpg',
                rating: '8.5'
            }],
            movies: [{
                id: 201,
                mediaType: 'movie',
                title: 'Cached Trending Movie',
                posterUrl: '/poster.jpg',
                bookmarkState: 'none'
            }],
            nowPlayingMovies: [],
            tvShows: [],
            airingTvShows: [],
            trendingPersonalizedSections: [],
            forYouSections: [{
                id: 'for-you-cached-lane',
                title: 'CACHED FOR YOU',
                items: [{
                    id: 301,
                    mediaType: 'movie',
                    title: 'Cached For You Pick',
                    posterUrl: '/poster301.jpg',
                    bookmarkState: 'none'
                }],
                queryContext: { type: 'discover_movies' }
            }]
        };

        localStorage.setItem(STORAGE_KEY_DISCOVER_FEED_CACHE, JSON.stringify(mockCache));
        const initial = getInitialTrendingState();

        expect(initial.hasLoadedTrendingData).toBeTrue();
        expect(initial.heroItems.length).toBe(1);
        expect(initial.heroItems[0].title).toBe('Cached Hero');
        expect(initial.movies.length).toBe(1);
        expect(initial.forYouSections.length).toBe(1);
        expect(initial.forYouSections[0].title).toBe('CACHED FOR YOU');
    });

    it('bypasses network calls when valid 12-hour cache exists on loadTrendingData', async () => {
        const mockCache: DiscoverFeedCachePayload = {
            generatedAt: Date.now(),
            expiresAt: Date.now() + 12 * 60 * 60 * 1000,
            heroItems: [],
            movies: [{
                id: 201,
                mediaType: 'movie',
                title: 'Cached Movie',
                posterUrl: '/poster.jpg',
                bookmarkState: 'none'
            }],
            nowPlayingMovies: [],
            tvShows: [],
            airingTvShows: [],
            trendingPersonalizedSections: [],
            forYouSections: []
        };
        localStorage.setItem(STORAGE_KEY_DISCOVER_FEED_CACHE, JSON.stringify(mockCache));

        await store.loadTrendingData(false);

        expect(trendingService.getTrendingAll).not.toHaveBeenCalled();
        expect(store.hasLoadedTrendingData()).toBeTrue();
    });

    it('does not send AI query when user pulls down to refresh For You', async () => {
        const ofEmpty = of({ results: [] });
        const mockRecEngine = {
            fetchAndHydrateAiLanes: jasmine.createSpy('fetchAndHydrateAiLanes').and.returnValue(Promise.resolve([])),
            rankSwimlaneItems: jasmine.createSpy('rankSwimlaneItems').and.callFake((items: SwimlaneItem[]) => items),
            buildMultiSeedCollaborativeSection: jasmine.createSpy('buildMultiSeedCollaborativeSection').and.returnValue(Promise.resolve(null))
        };

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                TrendingStore,
                { provide: TmdbTrendingService, useValue: trendingService },
                { provide: TmdbDiscoverService, useValue: { discoverMovies: jasmine.createSpy().and.returnValue(ofEmpty), discoverTv: jasmine.createSpy().and.returnValue(ofEmpty) } },
                { provide: RecommendationEngineService, useValue: mockRecEngine },
                { provide: TasteProfileService, useValue: { profile: (): { topSeeds: never[]; topGenrePairs: never[] } => ({ topSeeds: [], topGenrePairs: [] }) } },
                { provide: TmdbMoviesService, useValue: { getNowPlayingMovies: jasmine.createSpy().and.returnValue(ofEmpty), getMovieRecommendations: jasmine.createSpy().and.returnValue(ofEmpty) } },
                { provide: TmdbTvService, useValue: { getTvOnTheAir: jasmine.createSpy().and.returnValue(ofEmpty), getTvRecommendations: jasmine.createSpy().and.returnValue(ofEmpty) } },
                { provide: TmdbPeopleService, useValue: {} }
            ]
        });

        const customStore = TestBed.inject(TrendingStore);

        await customStore.loadForYouData(true, false);

        expect(mockRecEngine.fetchAndHydrateAiLanes).toHaveBeenCalledWith(jasmine.any(String), false);
    });

    it('triggers fresh network load and saves new 12-hour cache when cache is expired', async () => {
        const expiredCache: DiscoverFeedCachePayload = {
            generatedAt: Date.now() - 13 * 60 * 60 * 1000,
            expiresAt: Date.now() - 1 * 60 * 60 * 1000,
            heroItems: [],
            movies: [{
                id: 999,
                mediaType: 'movie',
                title: 'Old Expired Movie',
                posterUrl: '/old.jpg',
                bookmarkState: 'none'
            }],
            nowPlayingMovies: [],
            tvShows: [],
            airingTvShows: [],
            trendingPersonalizedSections: [],
            forYouSections: []
        };
        localStorage.setItem(STORAGE_KEY_DISCOVER_FEED_CACHE, JSON.stringify(expiredCache));

        const loadPromise = store.loadTrendingData(false);
        expect(trendingService.getTrendingAll).toHaveBeenCalledTimes(1);

        response.next({ results: [] });
        response.complete();
        await loadPromise;

        expect(store.hasLoadedTrendingData()).toBeTrue();
        const freshCacheRaw = localStorage.getItem(STORAGE_KEY_DISCOVER_FEED_CACHE);
        expect(freshCacheRaw).toBeTruthy();
        if (freshCacheRaw) {
            const freshCache = JSON.parse(freshCacheRaw) as DiscoverFeedCachePayload;
            expect(freshCache.expiresAt).toBeGreaterThan(Date.now());
        }
    });
});
