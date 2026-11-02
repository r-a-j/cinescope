import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { RecommendationEngineService } from './recommendation-engine.service';
import { TasteProfileService, UserTasteProfile } from './taste-profile.service';
import { StorageService } from './storage.service';
import { DiscoverPreferencesService, AiTasteCachePayload } from './discover-preferences.service';
import { TmdbDiscoverService } from './tmdb-discover.service';
import { TmdbMoviesService } from './tmdb-movies.service';
import { TmdbTvService } from './tmdb-tv.service';
import { TmdbSearchService } from './tmdb-search.service';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';

describe('RecommendationEngineService', () => {
  let service: RecommendationEngineService;
  let httpSpy: { post: jasmine.Spy };
  let discoverPrefsSpy: {
    hideWatchedInDiscover: ReturnType<typeof signal<boolean>>;
    getValidAiTasteCache: jasmine.Spy;
    aiTasteCache: jasmine.Spy;
    saveAiTasteCache: jasmine.Spy;
  };
  let discoverServiceSpy: { discoverMovies: jasmine.Spy; discoverTv: jasmine.Spy };
  let searchServiceSpy: { searchPerson: jasmine.Spy; searchKeywords: jasmine.Spy; searchMulti: jasmine.Spy };
  const mockWatchedKeys = signal<Set<string>>(new Set());

  const mockTasteProfile: UserTasteProfile = {
    fingerprint: 'test-fingerprint',
    totalInteractions: 10,
    isColdStart: false,
    genreWeights: { 28: 10, 878: 8 },
    topMovieGenreIds: [28, 878],
    topTvGenreIds: [10759],
    topGenrePairs: [],
    languageWeights: { en: 10 },
    topLanguages: ['en'],
    decadeWeights: {},
    preferredRuntimeMin: 120,
    topSeeds: [],
    watchlistSeeds: [],
    stalledTitles: [],
    stalledKeys: new Set(),
    dismissedKeys: new Set(),
    personAffinities: [],
    archetypes: []
  };

  beforeEach(() => {
    mockWatchedKeys.set(new Set());
    httpSpy = { post: jasmine.createSpy('post') };
    discoverPrefsSpy = {
      hideWatchedInDiscover: signal(true),
      getValidAiTasteCache: jasmine.createSpy('getValidAiTasteCache').and.returnValue(null),
      aiTasteCache: jasmine.createSpy('aiTasteCache').and.returnValue(null),
      saveAiTasteCache: jasmine.createSpy('saveAiTasteCache').and.returnValue(null)
    };
    discoverServiceSpy = {
      discoverMovies: jasmine.createSpy('discoverMovies').and.returnValue(of({ results: [] })),
      discoverTv: jasmine.createSpy('discoverTv').and.returnValue(of({ results: [] }))
    };
    searchServiceSpy = {
      searchPerson: jasmine.createSpy('searchPerson').and.returnValue(of({ results: [] })),
      searchKeywords: jasmine.createSpy('searchKeywords').and.returnValue(of({ results: [] })),
      searchMulti: jasmine.createSpy('searchMulti').and.returnValue(of({ results: [] }))
    };

    TestBed.configureTestingModule({
      providers: [
        RecommendationEngineService,
        { provide: HttpClient, useValue: httpSpy },
        {
          provide: TasteProfileService,
          useValue: {
            profile: signal(mockTasteProfile)
          }
        },
        {
          provide: StorageService,
          useValue: {
            watchedMediaKeys: mockWatchedKeys,
            allowAdultContent: signal(false)
          }
        },
        {
          provide: DiscoverPreferencesService,
          useValue: discoverPrefsSpy
        },
        { provide: TmdbDiscoverService, useValue: discoverServiceSpy },
        { provide: TmdbMoviesService, useValue: {} },
        { provide: TmdbTvService, useValue: {} },
        { provide: TmdbSearchService, useValue: searchServiceSpy }
      ]
    });

    service = TestBed.inject(RecommendationEngineService);
  });

  describe('rankSwimlaneItems', () => {
    it('filters out unreleased / future titles by default', () => {
      const items: SwimlaneItem[] = [
        {
          id: 1,
          mediaType: 'movie',
          title: 'Released Hit',
          posterUrl: '/poster1.jpg',
          bookmarkState: 'none',
          payload: {
            id: 1,
            title: 'Released Hit',
            release_date: '2023-01-01',
            vote_average: 8.0,
            vote_count: 500
          }
        },
        {
          id: 2,
          mediaType: 'movie',
          title: 'Unreleased Future Sequel',
          posterUrl: '/poster2.jpg',
          bookmarkState: 'none',
          payload: {
            id: 2,
            title: 'Unreleased Future Sequel',
            release_date: '2029-07-15',
            status: 'In Production',
            vote_average: 0,
            vote_count: 0
          }
        }
      ];

      const ranked = service.rankSwimlaneItems(items);
      const rankedIds = ranked.map((i) => i.id);

      expect(rankedIds).toContain(1);
      expect(rankedIds).not.toContain(2);
    });

    it('filters out adult content when allowAdultContent is false', () => {
      const items: SwimlaneItem[] = [
        {
          id: 1,
          mediaType: 'movie',
          title: 'Family Safe Movie',
          posterUrl: '/poster1.jpg',
          bookmarkState: 'none',
          payload: {
            id: 1,
            title: 'Family Safe Movie',
            adult: false,
            release_date: '2023-01-01',
            vote_average: 8.0,
            vote_count: 500
          }
        },
        {
          id: 99,
          mediaType: 'movie',
          title: 'Adult 18+ Movie',
          posterUrl: '/adult.jpg',
          bookmarkState: 'none',
          payload: {
            id: 99,
            title: 'Adult 18+ Movie',
            adult: true,
            release_date: '2023-01-01',
            vote_average: 7.0,
            vote_count: 100
          }
        }
      ];

      const ranked = service.rankSwimlaneItems(items);
      const rankedIds = ranked.map((i) => i.id);

      expect(rankedIds).toContain(1);
      expect(rankedIds).not.toContain(99);
    });

    it('allows unreleased titles when allowUnreleased is true', () => {
      const items: SwimlaneItem[] = [
        {
          id: 2,
          mediaType: 'movie',
          title: 'Upcoming Festival Film',
          posterUrl: '/poster2.jpg',
          bookmarkState: 'none',
          payload: {
            id: 2,
            title: 'Upcoming Festival Film',
            release_date: '2029-07-15',
            status: 'Planned'
          }
        }
      ];

      const ranked = service.rankSwimlaneItems(items, { allowUnreleased: true });
      expect(ranked.map((i) => i.id)).toContain(2);
    });

    it('excludes items that are in seenKeys', () => {
      const items: SwimlaneItem[] = [
        {
          id: 10,
          mediaType: 'movie',
          title: 'Already Shown Movie',
          posterUrl: '/poster10.jpg',
          bookmarkState: 'none',
          payload: { id: 10, title: 'Already Shown Movie', release_date: '2020-01-01' }
        },
        {
          id: 20,
          mediaType: 'movie',
          title: 'Fresh Movie',
          posterUrl: '/poster20.jpg',
          bookmarkState: 'none',
          payload: { id: 20, title: 'Fresh Movie', release_date: '2020-01-01' }
        }
      ];

      const seenKeys = new Set<string>(['movie_10']);
      const ranked = service.rankSwimlaneItems(items, { seenKeys });

      expect(ranked.map((i) => i.id)).toEqual([20]);
    });
  });

  describe('fetchAndHydrateAiLanes', () => {
    it('does not call /api/recommend when valid 12h AI taste cache exists on forceRefresh = false', async () => {
      const validCache: AiTasteCachePayload = {
        generatedAt: Date.now() - 60 * 1000,
        expiresAt: Date.now() + 11 * 60 * 60 * 1000,
        seedSummary: 'test-fingerprint',
        lanes: [
          {
            id: 'lane-1',
            title: 'AI Curated Thrillers',
            mediaType: 'movie',
            movieParams: { with_genres: '53' },
            curatedItems: []
          }
        ]
      };
      discoverPrefsSpy.getValidAiTasteCache.and.returnValue(validCache);

      const lanes = await service.fetchAndHydrateAiLanes('hi|en', false);

      expect(httpSpy.post).not.toHaveBeenCalled();
      expect(lanes.length).toBe(0); // discoverMovies returned empty results in mock
    });

    it('calls /api/recommend when forceRefresh is true even if valid cache exists', async () => {
      const validCache: AiTasteCachePayload = {
        generatedAt: Date.now() - 60 * 1000,
        expiresAt: Date.now() + 11 * 60 * 60 * 1000,
        seedSummary: 'test-fingerprint',
        lanes: []
      };
      discoverPrefsSpy.getValidAiTasteCache.and.returnValue(validCache);
      httpSpy.post.and.returnValue(of({ lanes: [] }));

      await service.fetchAndHydrateAiLanes('hi|en', true);

      expect(httpSpy.post).toHaveBeenCalled();
    });
  });
});
