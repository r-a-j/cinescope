import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { SmartSearchService } from '../services/smart-search.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';
import { TmdbSearchService } from '../services/tmdb-search.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { SearchStore } from './search.store';

describe('SearchStore Smart Search', () => {
    const query = 'mind-bending science fiction movies from 2010 onward with high ratings';
    const oldMovie = {
        id: 1124,
        title: 'The Prestige',
        original_title: 'The Prestige',
        release_date: '2006-10-17',
        adult: false,
        backdrop_path: null,
        overview: '',
        poster_path: '/prestige.jpg',
        original_language: 'en',
        genre_ids: [878],
        popularity: 1,
        video: false,
        vote_average: 8.2,
        vote_count: 1000
    };
    const recentMovie = {
        ...oldMovie,
        id: 27205,
        title: 'Inception',
        original_title: 'Inception',
        release_date: '2010-07-15',
        poster_path: '/inception.jpg'
    };

    let store: InstanceType<typeof SearchStore>;
    let searchService: {
        searchMulti: jasmine.Spy;
        searchCollections: jasmine.Spy;
        searchPerson: jasmine.Spy;
        searchKeywords: jasmine.Spy;
        getWikidataImage: jasmine.Spy;
        getSpellingSuggestion: jasmine.Spy;
    };
    let discoverService: {
        discoverMovies: jasmine.Spy;
        discoverTv: jasmine.Spy;
    };
    let smartSearchService: {
        getSmartSuggestions: jasmine.Spy;
    };

    beforeEach(() => {
        const emptyResponse = { page: 1, results: [], total_pages: 1, total_results: 0 };
        searchService = {
            searchMulti: jasmine.createSpy('searchMulti').and.returnValue(of(emptyResponse)),
            searchCollections: jasmine.createSpy('searchCollections').and.returnValue(of(emptyResponse)),
            searchPerson: jasmine.createSpy('searchPerson').and.returnValue(of(emptyResponse)),
            searchKeywords: jasmine.createSpy('searchKeywords').and.returnValue(of(emptyResponse)),
            getWikidataImage: jasmine.createSpy('getWikidataImage').and.returnValue(of(null)),
            getSpellingSuggestion: jasmine.createSpy('getSpellingSuggestion').and.returnValue(of(null))
        };
        discoverService = {
            discoverMovies: jasmine.createSpy('discoverMovies').and.returnValue(of({
                page: 1,
                results: [oldMovie, recentMovie],
                total_pages: 1,
                total_results: 2
            })),
            discoverTv: jasmine.createSpy('discoverTv').and.returnValue(of(emptyResponse))
        };
        smartSearchService = {
            getSmartSuggestions: jasmine.createSpy('getSmartSuggestions').and.returnValue(of({
                sections: [{
                    title: 'Mind-Bending Sci-Fi Masterpieces',
                    action: 'discover_movies',
                    parameters: { genres: [878], sort_by: 'vote_average.desc' }
                }]
            }))
        };

        TestBed.configureTestingModule({
            providers: [
                SearchStore,
                { provide: TmdbSearchService, useValue: searchService },
                { provide: TmdbMoviesService, useValue: { getMovieExternalIds: jasmine.createSpy().and.returnValue(of({ wikidata_id: null })) } },
                { provide: TmdbPeopleService, useValue: { getPersonExternalIds: jasmine.createSpy().and.returnValue(of({ wikidata_id: null })) } },
                { provide: TmdbTvService, useValue: { getTvExternalIds: jasmine.createSpy().and.returnValue(of({ wikidata_id: null })) } },
                { provide: TmdbDiscoverService, useValue: discoverService },
                { provide: SmartSearchService, useValue: smartSearchService },
                { provide: DatabaseService, useValue: { getDatabase: jasmine.createSpy().and.resolveTo({ searchHistory: {} }) } }
            ]
        });
        store = TestBed.inject(SearchStore);
    });

    it('applies and enforces a lower release-year bound for Smart Search', fakeAsync(() => {
        store.searchQuery(query);
        tick(350);
        flushMicrotasks();

        let completed = false;
        void store.executeSmartSearch().then(() => completed = true);
        flushMicrotasks();

        expect(completed).toBeTrue();
        expect(discoverService.discoverMovies).toHaveBeenCalledWith(
            jasmine.objectContaining({ 'primary_release_date.gte': '2010-01-01' })
        );
        expect(store.smartResults().map(movie => 'title' in movie ? movie.title : movie.name)).toEqual(['Inception']);
    }));

    it('enforces a lower release-year bound on exact-match results too', fakeAsync(() => {
        const exactSearchServiceResponse = {
            page: 1,
            results: [
                { ...oldMovie, media_type: 'movie' as const },
                { ...recentMovie, media_type: 'movie' as const }
            ],
            total_pages: 1,
            total_results: 2
        };
        searchService.searchMulti.and.returnValue(of(exactSearchServiceResponse));
        smartSearchService.getSmartSuggestions.and.returnValue(of({
            sections: [{
                title: 'Results',
                action: 'exact_match',
                parameters: { query: 'science fiction movies from 2010 onward' }
            }]
        }));

        store.searchQuery(query);
        tick(350);
        flushMicrotasks();

        let completed = false;
        void store.executeSmartSearch().then(() => completed = true);
        flushMicrotasks();

        expect(completed).toBeTrue();
        expect(store.smartResults().map(movie => 'title' in movie ? movie.title : movie.name)).toEqual(['Inception']);
    }));

    it('auto-corrects dropped-vowel typos ("crwlers" -> "crawlers") before requiring AI search', fakeAsync(() => {
        const emptyResponse = { page: 1, results: [], total_pages: 1, total_results: 0 };
        const crawlersMovie = {
            ...recentMovie,
            id: 660120,
            title: 'Crawlers',
            original_title: 'Crawlers',
            media_type: 'movie' as const
        };
        searchService.searchMulti.and.callFake((q: string) => {
            if (q === 'crawlers') {
                return of({ page: 1, results: [crawlersMovie], total_pages: 1, total_results: 1 });
            }
            return of(emptyResponse);
        });

        store.searchQuery('crwlers');
        tick(350);
        flushMicrotasks();

        expect(store.correctedQuery()).toBe('crawlers');
        expect(store.results().length).toBe(1);
        const firstResult = store.results()[0];
        expect(firstResult && 'title' in firstResult ? firstResult.title : '').toBe('Crawlers');
    }));
});
