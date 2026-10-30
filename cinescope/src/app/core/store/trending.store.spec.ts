import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TrendingStore } from './trending.store';
import { TmdbTrendingService } from '../services/tmdb-trending.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';

describe('TrendingStore', () => {
    let response: Subject<{ results: never[] }>;
    let trendingService: {
        getTrendingAll: jasmine.Spy;
        getTrendingMovies: jasmine.Spy;
        getTrendingTvShows: jasmine.Spy;
    };
    let store: InstanceType<typeof TrendingStore>;

    beforeEach(() => {
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
                { provide: TmdbMoviesService, useValue: { getNowPlayingMovies: jasmine.createSpy().and.returnValue(observable) } },
                { provide: TmdbTvService, useValue: { getTvOnTheAir: jasmine.createSpy().and.returnValue(observable) } },
                { provide: TmdbPeopleService, useValue: {} }
            ]
        });
        store = TestBed.inject(TrendingStore);
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
});
