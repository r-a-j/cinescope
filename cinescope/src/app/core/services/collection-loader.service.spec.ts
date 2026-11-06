import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CollectionLoaderService, CollectionQueryContext } from './collection-loader.service';
import { StorageService } from './storage.service';
import { TmdbDiscoverService } from './tmdb-discover.service';
import { TmdbTrendingService } from './tmdb-trending.service';
import { TmdbPeopleService } from './tmdb-people.service';
import { TmdbMoviesService } from './tmdb-movies.service';
import { TmdbTvService } from './tmdb-tv.service';
import { TmdbDiscoverMovieParamsDto } from '../dtos/discover/discover-movie-params.dto';
import { TmdbDiscoverTvParamsDto } from '../dtos/discover/discover-tv-params.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';

describe('CollectionLoaderService - Cascading Relaxation', () => {
  let service: CollectionLoaderService;
  let discoverServiceSpy: jasmine.SpyObj<TmdbDiscoverService>;

  beforeEach(() => {
    discoverServiceSpy = jasmine.createSpyObj('TmdbDiscoverService', ['discoverMovies', 'discoverTv']);

    TestBed.configureTestingModule({
      providers: [
        CollectionLoaderService,
        { provide: TmdbDiscoverService, useValue: discoverServiceSpy },
        { provide: TmdbTrendingService, useValue: {} },
        { provide: TmdbPeopleService, useValue: {} },
        { provide: TmdbMoviesService, useValue: {} },
        { provide: TmdbTvService, useValue: {} },
        {
          provide: StorageService,
          useValue: {
            userRegion: (): string => 'IN',
            allowAdultContent: signal(false),
            getBookmarkState: (): 'none' => 'none'
          }
        }
      ]
    });

    service = TestBed.inject(CollectionLoaderService);
  });

  describe('getRelaxedMovieParams', () => {
    it('relaxes strict AND genres, deletes narrow keywords and cast, and lowers vote thresholds', () => {
      const strictParams: TmdbDiscoverMovieParamsDto = {
        with_original_language: 'hi|en',
        with_genres: '80,53',
        with_keywords: '123|456',
        with_cast: '999',
        'vote_average.gte': 7.2,
        'vote_count.gte': 35,
        sort_by: 'popularity.desc'
      };

      const relaxed = service.getRelaxedMovieParams(strictParams);
      expect(relaxed).not.toBeNull();
      expect(relaxed?.with_genres).toBe('80|53');
      expect(relaxed?.with_keywords).toBeUndefined();
      expect(relaxed?.with_cast).toBeUndefined();
      expect(relaxed?.['vote_average.gte']).toBe(5.5);
      expect(relaxed?.['vote_count.gte']).toBe(10);
      expect(relaxed?.with_original_language).toBe('hi|en');
    });

    it('returns null if parameters are already relaxed with no strict constraints', () => {
      const alreadyBroadParams: TmdbDiscoverMovieParamsDto = {
        with_original_language: 'hi',
        sort_by: 'popularity.desc'
      };

      expect(service.getRelaxedMovieParams(alreadyBroadParams)).toBeNull();
    });
  });

  describe('getRelaxedTvParams', () => {
    it('relaxes strict TV AND genres to OR and drops narrow keywords', () => {
      const strictTvParams: TmdbDiscoverTvParamsDto = {
        with_original_language: 'ko',
        with_genres: '80,18',
        with_keywords: '555',
        'vote_average.gte': 7.5,
        'vote_count.gte': 40
      };

      const relaxed = service.getRelaxedTvParams(strictTvParams);
      expect(relaxed).not.toBeNull();
      expect(relaxed?.with_genres).toBe('80|18');
      expect(relaxed?.with_keywords).toBeUndefined();
      expect(relaxed?.['vote_average.gte']).toBe(5.5);
      expect(relaxed?.['vote_count.gte']).toBe(10);
      expect(relaxed?.with_original_language).toBe('ko');
    });
  });

  describe('fetchPage cascading transition', () => {
    it('signals hasMore true when tier 1 completes, then seamlessly queries relaxed tier on next page', async () => {
      const strictParams: TmdbDiscoverMovieParamsDto = {
        with_original_language: 'hi|en',
        with_genres: '80,53',
        with_keywords: '100',
        'vote_average.gte': 7.0,
        sort_by: 'popularity.desc'
      };

      const context: CollectionQueryContext = {
        type: 'discover_movies',
        movieParams: strictParams
      };

      // Tier 1 response (only 1 page total)
      discoverServiceSpy.discoverMovies.and.callFake((params: TmdbDiscoverMovieParamsDto) => {
        if (params.with_genres === '80,53') {
          return of({
            page: 1,
            total_pages: 1,
            total_results: 5,
            results: [
              { id: 101, title: 'Gangster Noir 1', poster_path: '/p1.jpg' } as unknown as TmdbMovieListItemDto
            ]
          });
        }
        // Tier 2 relaxed response (relaxing to 80|53)
        return of({
          page: params.page || 1,
          total_pages: 10,
          total_results: 200,
          results: [
            { id: 201, title: 'Relaxed Crime Thriller 1', poster_path: '/p2.jpg' } as unknown as TmdbMovieListItemDto
          ]
        });
      });

      // Page 1: Strict Tier 1
      const page1 = await service.fetchPage('Gritty Indian Noir', 1, 'featured', context);
      expect(page1.items.length).toBe(1);
      expect(page1.items[0].id).toBe(101);
      expect(page1.hasMore).toBeTrue(); // Tier 1 has ended, but relaxable tier exists!

      // Page 2: Should query Tier 2 (page 1)
      const page2 = await service.fetchPage('Gritty Indian Noir', 2, 'featured', context);
      expect(page2.items.length).toBe(1);
      expect(page2.items[0].id).toBe(201);
      expect(page2.hasMore).toBeTrue();
    });
  });
});
