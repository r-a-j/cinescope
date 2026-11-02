import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { RecommendationEngineService } from './recommendation-engine.service';
import { TasteProfileService, UserTasteProfile } from './taste-profile.service';
import { StorageService } from './storage.service';
import { DiscoverPreferencesService } from './discover-preferences.service';
import { TmdbDiscoverService } from './tmdb-discover.service';
import { TmdbMoviesService } from './tmdb-movies.service';
import { TmdbTvService } from './tmdb-tv.service';
import { TmdbSearchService } from './tmdb-search.service';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';

describe('RecommendationEngineService', () => {
  let service: RecommendationEngineService;
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

    TestBed.configureTestingModule({
      providers: [
        RecommendationEngineService,
        { provide: HttpClient, useValue: {} },
        {
          provide: TasteProfileService,
          useValue: {
            profile: signal(mockTasteProfile)
          }
        },
        {
          provide: StorageService,
          useValue: {
            watchedMediaKeys: mockWatchedKeys
          }
        },
        {
          provide: DiscoverPreferencesService,
          useValue: {
            hideWatchedInDiscover: signal(true),
            getValidAiTasteCache: (): null => null,
            aiTasteCache: (): null => null,
            saveAiTasteCache: (): null => null
          }
        },
        { provide: TmdbDiscoverService, useValue: {} },
        { provide: TmdbMoviesService, useValue: {} },
        { provide: TmdbTvService, useValue: {} },
        { provide: TmdbSearchService, useValue: {} }
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
});
