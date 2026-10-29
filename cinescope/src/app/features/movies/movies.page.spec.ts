import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { MoviesPage } from './movies.page';
import { StorageService } from '../../core/services/storage.service';
import { FranchiseAggregatorService } from '../../core/services/franchise-aggregator.service';
import { ToastService } from '../../core/services/toast.service';
import { MoviesPreferencesService } from '../../core/services/movies-preferences.service';
import { TmdbMoviesService } from '../../core/services/tmdb-movies.service';
import { of } from 'rxjs';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { FranchiseCollectionSummary } from '../../core/models/franchise.model';

describe('MoviesPage', () => {
  let component: MoviesPage;
  let fixture: ComponentFixture<MoviesPage>;
  const baselineFranchises: FranchiseCollectionSummary[] = [
    {
      id: 1,
      name: 'Mission: Impossible Series',
      totalParts: 7,
      watchedCount: 5,
      collectedCount: 6,
      watchlistCount: 1,
      completionPercentage: 71
    }
  ];

  const mockWatchlistItems = signal<ContentDocType[]>([
    {
      id: 'movie_1',
      tmdbId: 101,
      mediaType: 'movie',
      lists: ['watchlist'],
      addedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago (graveyard)
      payload: {
        id: 101,
        title: 'Inception',
        runtime: 148,
        vote_average: 8.8,
        genre_ids: [28, 878],
        poster_path: '/inception.jpg',
        overview: 'A thief who steals corporate secrets through dream-sharing.'
      }
    },
    {
      id: 'movie_2',
      tmdbId: 102,
      mediaType: 'movie',
      lists: ['watchlist'],
      addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      payload: {
        id: 102,
        title: 'Whiplash',
        runtime: 88,
        vote_average: 8.5,
        genre_ids: [18, 10402],
        poster_path: '/whiplash.jpg',
        overview: 'A promising drummer enrolls at a cut-throat music conservatory.'
      }
    },
    {
      id: 'tv_1',
      tmdbId: 201,
      mediaType: 'tv',
      lists: ['watchlist'],
      addedAt: new Date().toISOString(),
      payload: {
        id: 201,
        name: 'Severance',
        vote_average: 8.7
      }
    }
  ]);

  const mockStorageService = {
    watchlistItems: mockWatchlistItems,
    userRegion: signal('US'),
    getBookmarkState: jasmine.createSpy('getBookmarkState').and.returnValue('watchlist'),
    cycleBookmark: jasmine.createSpy('cycleBookmark').and.returnValue(Promise.resolve('watchlist')),
    removeMedia: jasmine.createSpy('removeMedia').and.returnValue(Promise.resolve()),
    addToWatchlist: jasmine.createSpy('addToWatchlist').and.returnValue(Promise.resolve()),
    moveToWatched: jasmine.createSpy('moveToWatched').and.returnValue(Promise.resolve(true))
  };

  const mockFranchiseAggregatorService = {
    activeUserFranchises: signal<FranchiseCollectionSummary[]>(baselineFranchises)
  };

  const mockToastService = {
    presentSuccess: jasmine.createSpy('presentSuccess').and.returnValue(Promise.resolve()),
    presentInfo: jasmine.createSpy('presentInfo').and.returnValue(Promise.resolve()),
    presentWarning: jasmine.createSpy('presentWarning').and.returnValue(Promise.resolve()),
    presentError: jasmine.createSpy('presentError').and.returnValue(Promise.resolve())
  };

  const mockVisibility = signal({
    cineMatch: true,
    franchises: true,
    blindTicket: true
  });

  const mockMoviesPreferencesService = {
    visibility: mockVisibility,
    toggleSection: jasmine.createSpy('toggleSection').and.callFake((sec: string) => {
      mockVisibility.update(v => ({ ...v, [sec]: !v[sec as keyof typeof v] }));
    }),
    resetToDefault: jasmine.createSpy('resetToDefault').and.callFake(() => {
      mockVisibility.set({
        cineMatch: true,
        franchises: true,
        blindTicket: true
      });
      return Promise.resolve();
    })
  };

  const mockTmdbMoviesService = {
    getMovieWatchProviders: jasmine.createSpy('getMovieWatchProviders').and.returnValue(of({
      id: 101,
      results: {}
    }))
  };

  beforeEach(async () => {
    mockFranchiseAggregatorService.activeUserFranchises.set(baselineFranchises);
    await TestBed.configureTestingModule({
      imports: [MoviesPage],
      providers: [
        provideRouter([]),
        { provide: StorageService, useValue: mockStorageService },
        { provide: FranchiseAggregatorService, useValue: mockFranchiseAggregatorService },
        { provide: ToastService, useValue: mockToastService },
        { provide: MoviesPreferencesService, useValue: mockMoviesPreferencesService },
        { provide: TmdbMoviesService, useValue: mockTmdbMoviesService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MoviesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create MoviesPage successfully with subcomponents', () => {
    expect(component).toBeTruthy();
  });

  it('should filter watchlist items strictly to movies', () => {
    const movies = component.watchlistMovies();
    expect(movies.length).toBe(2);
    expect(movies.every(m => m.mediaType === 'movie')).toBeTrue();
  });

  it('should reflect visibility from MoviesPreferencesService', () => {
    const vis = component.moviesPrefs.visibility();
    expect(vis.cineMatch).toBeTrue();
    expect(vis.franchises).toBeTrue();
    expect(vis.blindTicket).toBeTrue();
    expect(component.allSectionsHidden()).toBeFalse();
  });

  it('only suggests unfinished franchises or completed sagas with upcoming releases', () => {
    mockFranchiseAggregatorService.activeUserFranchises.set([
      {
        id: 1,
        name: 'Completed Saga',
        totalParts: 4,
        watchedCount: 4,
        collectedCount: 4,
        watchlistCount: 0,
        completionPercentage: 100,
        upcomingPartsCount: 0
      },
      {
        id: 2,
        name: 'Saga To Continue',
        totalParts: 5,
        watchedCount: 2,
        collectedCount: 3,
        watchlistCount: 1,
        completionPercentage: 40,
        upcomingPartsCount: 0,
        upNextPart: { id: 202, title: 'Next Chapter' }
      },
      {
        id: 3,
        name: 'Caught Up Saga',
        totalParts: 3,
        watchedCount: 3,
        collectedCount: 3,
        watchlistCount: 0,
        completionPercentage: 100,
        upcomingPartsCount: 1
      },
      {
        id: 4,
        name: 'Queued Saga',
        totalParts: 6,
        watchedCount: 1,
        collectedCount: 3,
        watchlistCount: 2,
        completionPercentage: 17
      },
      {
        id: 5,
        name: 'Saga To Start',
        totalParts: 4,
        watchedCount: 0,
        collectedCount: 0,
        watchlistCount: 0,
        completionPercentage: 0
      }
    ]);

    expect(component.franchiseSuggestions().map(franchise => franchise.id)).toEqual([2, 4, 3, 5]);
  });

  it('should detect when all sections are hidden', () => {
    mockVisibility.set({
      cineMatch: false,
      franchises: false,
      blindTicket: false
    });
    expect(component.allSectionsHidden()).toBeTrue();

    // Reset back
    mockVisibility.set({
      cineMatch: true,
      franchises: true,
      blindTicket: true
    });
    expect(component.allSectionsHidden()).toBeFalse();
  });
});
