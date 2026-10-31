import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MediaMetadataService } from './media-metadata.service';
import { TmdbMoviesService } from './tmdb-movies.service';
import { TmdbTvService } from './tmdb-tv.service';
import { TmdbTvSeasonsService } from './tmdb-tv-seasons.service';
import { StorageService } from './storage.service';
import { TvProgressService } from './tv-progress.service';
import { PosterCacheService } from './poster-cache.service';
import { DEFAULT_POSTER_PLACEHOLDER } from '../constants/api.constants';
import { TmdbTvDetailDto } from '../dtos/tv/tv-detail.dto';
import { TmdbMovieDetailDto } from '../dtos/movies/movie-detail.dto';
import { ContentDocType } from '../database/schemas/content.schema';

describe('MediaMetadataService', () => {
  let service: MediaMetadataService;

  let mockTmdbMovies: { getMovieDetails: jasmine.Spy };
  let mockTmdbTv: { getTvShowDetails: jasmine.Spy };
  let mockTmdbTvSeasons: { getTvSeasonDetails: jasmine.Spy };
  let mockStorage: {
    generateId: jasmine.Spy;
    updateMediaPayload: jasmine.Spy;
    getCachedDoc: jasmine.Spy;
  };
  let mockTvProgress: {
    getSeriesProgress: jasmine.Spy;
    syncSeriesMeta: jasmine.Spy;
  };
  let mockPosterCache: {
    prewarmUrls: jasmine.Spy;
  };

  const sampleTvDetail: Partial<TmdbTvDetailDto> = {
    id: 95396,
    name: 'Severance',
    poster_path: '/severance_new.jpg',
    backdrop_path: '/severance_bg.jpg',
    status: 'Returning Series',
    number_of_seasons: 2,
    number_of_episodes: 19,
    seasons: [],
    vote_average: 8.7
  };

  const sampleMovieDetail: Partial<TmdbMovieDetailDto> = {
    id: 550,
    title: 'Fight Club',
    poster_path: '/fightclub_new.jpg',
    backdrop_path: '/fightclub_bg.jpg',
    status: 'Released',
    release_date: '1999-10-15',
    vote_average: 8.4
  };

  beforeEach(() => {
    mockTmdbMovies = {
      getMovieDetails: jasmine.createSpy('getMovieDetails').and.returnValue(of(sampleMovieDetail))
    };
    mockTmdbTv = {
      getTvShowDetails: jasmine.createSpy('getTvShowDetails').and.returnValue(of(sampleTvDetail))
    };
    mockTmdbTvSeasons = {
      getTvSeasonDetails: jasmine.createSpy('getTvSeasonDetails').and.returnValue(of(null))
    };
    mockStorage = {
      generateId: jasmine.createSpy('generateId').and.callFake((id, type) => `${type}_${id}`),
      updateMediaPayload: jasmine.createSpy('updateMediaPayload').and.returnValue(Promise.resolve()),
      getCachedDoc: jasmine.createSpy('getCachedDoc').and.returnValue(null)
    };
    mockTvProgress = {
      getSeriesProgress: jasmine.createSpy('getSeriesProgress').and.returnValue(null),
      syncSeriesMeta: jasmine.createSpy('syncSeriesMeta').and.returnValue(Promise.resolve())
    };
    mockPosterCache = {
      prewarmUrls: jasmine.createSpy('prewarmUrls')
    };

    TestBed.configureTestingModule({
      providers: [
        MediaMetadataService,
        { provide: TmdbMoviesService, useValue: mockTmdbMovies },
        { provide: TmdbTvService, useValue: mockTmdbTv },
        { provide: TmdbTvSeasonsService, useValue: mockTmdbTvSeasons },
        { provide: StorageService, useValue: mockStorage },
        { provide: TvProgressService, useValue: mockTvProgress },
        { provide: PosterCacheService, useValue: mockPosterCache }
      ]
    });

    service = TestBed.inject(MediaMetadataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('healMediaMetadata', () => {
    it('should return false for invalid tmdbId', async () => {
      const result = await service.healMediaMetadata(0, 'tv');
      expect(result).toBeFalse();
      expect(mockTmdbTv.getTvShowDetails).not.toHaveBeenCalled();
    });

    it('should heal TV show metadata, update storage and prewarm poster', async () => {
      mockTvProgress.getSeriesProgress.and.returnValue({ tmdbId: 95396 });

      const healed = await service.healMediaMetadata(95396, 'tv');

      expect(healed).toBeTrue();
      expect(mockTmdbTv.getTvShowDetails).toHaveBeenCalledWith(95396);
      expect(mockStorage.updateMediaPayload).toHaveBeenCalledWith(
        'tv_95396',
        jasmine.objectContaining({
          poster_path: '/severance_new.jpg',
          name: 'Severance',
          number_of_seasons: 2
        })
      );
      expect(mockTvProgress.syncSeriesMeta).toHaveBeenCalledWith(sampleTvDetail as TmdbTvDetailDto);
      expect(mockPosterCache.prewarmUrls).toHaveBeenCalledWith([
        'https://image.tmdb.org/t/p/w342/severance_new.jpg'
      ]);
    });

    it('should heal Movie metadata, update storage and prewarm poster', async () => {
      const healed = await service.healMediaMetadata(550, 'movie');

      expect(healed).toBeTrue();
      expect(mockTmdbMovies.getMovieDetails).toHaveBeenCalledWith(550);
      expect(mockStorage.updateMediaPayload).toHaveBeenCalledWith(
        'movie_550',
        jasmine.objectContaining({
          poster_path: '/fightclub_new.jpg',
          title: 'Fight Club'
        })
      );
      expect(mockPosterCache.prewarmUrls).toHaveBeenCalledWith([
        'https://image.tmdb.org/t/p/w342/fightclub_new.jpg'
      ]);
    });

    it('should prevent concurrent redundant lookups for the same media key', async () => {
      const p1 = service.healMediaMetadata(95396, 'tv');
      const p2 = service.healMediaMetadata(95396, 'tv');

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBeTrue();
      expect(res2).toBeFalse();
      expect(mockTmdbTv.getTvShowDetails).toHaveBeenCalledTimes(1);
    });

    it('should gracefully handle API errors and clean up in-flight lookups', async () => {
      mockTmdbTv.getTvShowDetails.and.returnValue(throwError(() => new Error('TMDB Network error')));

      const result = await service.healMediaMetadata(95396, 'tv');
      expect(result).toBeFalse();

      // Subsequent attempt should not be blocked by lingering in-flight key
      mockTmdbTv.getTvShowDetails.and.returnValue(of(sampleTvDetail));
      const secondAttempt = await service.healMediaMetadata(95396, 'tv');
      expect(secondAttempt).toBeTrue();
    });
  });

  describe('syncActiveLibraryDoc', () => {
    it('should ignore calls when document is not in local library cache', async () => {
      mockStorage.getCachedDoc.and.returnValue(null);

      await service.syncActiveLibraryDoc(95396, 'tv', sampleTvDetail as TmdbTvDetailDto);

      expect(mockStorage.updateMediaPayload).not.toHaveBeenCalled();
    });

    it('should update local library doc when it exists in cache', async () => {
      const mockCachedDoc = { id: 'tv_95396', tmdbId: 95396 } as ContentDocType;
      mockStorage.getCachedDoc.and.returnValue(mockCachedDoc);

      await service.syncActiveLibraryDoc(95396, 'tv', sampleTvDetail as TmdbTvDetailDto);

      expect(mockStorage.updateMediaPayload).toHaveBeenCalledWith(
        'tv_95396',
        jasmine.objectContaining({
          poster_path: '/severance_new.jpg',
          name: 'Severance'
        })
      );
      expect(mockPosterCache.prewarmUrls).toHaveBeenCalled();
    });
  });

  describe('handleImageError', () => {
    it('should assign placeholder image and dispatch background healing', () => {
      spyOn(service, 'healMediaMetadata').and.returnValue(Promise.resolve(true));

      const fakeImg = document.createElement('img');
      fakeImg.src = 'https://image.tmdb.org/t/p/w342/broken_dead_poster.jpg';

      const fakeEvent = {
        target: fakeImg
      } as unknown as Event;

      service.handleImageError(fakeEvent, 95396, 'tv');

      expect(fakeImg.src).toContain(DEFAULT_POSTER_PLACEHOLDER);
      expect(service.healMediaMetadata).toHaveBeenCalledWith(95396, 'tv');
    });

    it('should avoid loop if img already has placeholder source', () => {
      spyOn(service, 'healMediaMetadata').and.returnValue(Promise.resolve(true));

      const fakeImg = document.createElement('img');
      fakeImg.src = DEFAULT_POSTER_PLACEHOLDER;

      const fakeEvent = {
        target: fakeImg
      } as unknown as Event;

      service.handleImageError(fakeEvent, 95396, 'tv');

      expect(fakeImg.src).toContain(DEFAULT_POSTER_PLACEHOLDER);
    });
  });

  describe('queueBackgroundHealing', () => {
    it('should queue and process items politely in batches', fakeAsync(() => {
      spyOn(service, 'healMediaMetadata').and.returnValue(Promise.resolve(true));

      service.queueBackgroundHealing([
        { tmdbId: 101, mediaType: 'tv' },
        { tmdbId: 102, mediaType: 'tv' },
        { tmdbId: 103, mediaType: 'movie' }
      ]);

      // Process batch 1
      tick(200);
      expect(service.healMediaMetadata).toHaveBeenCalledWith(101, 'tv');
      expect(service.healMediaMetadata).toHaveBeenCalledWith(102, 'tv');

      // Process batch 2
      tick(200);
      expect(service.healMediaMetadata).toHaveBeenCalledWith(103, 'movie');
    }));
  });

  describe('getEpisodeStillUrl', () => {
    it('should return null for invalid inputs', async () => {
      expect(await service.getEpisodeStillUrl(0, 1, 1)).toBeNull();
      expect(await service.getEpisodeStillUrl(95396, 0, 1)).toBeNull();
      expect(await service.getEpisodeStillUrl(95396, 1, 0)).toBeNull();
    });

    it('should resolve immediately from next_episode_to_air when present in cached doc', async () => {
      mockStorage.getCachedDoc.and.returnValue({
        id: 'tv_95396',
        payload: {
          next_episode_to_air: {
            season_number: 1,
            episode_number: 4,
            still_path: '/severance_s1e4.jpg'
          }
        }
      });

      const url = await service.getEpisodeStillUrl(95396, 1, 4);

      expect(url).toContain('/severance_s1e4.jpg');
      expect(mockPosterCache.prewarmUrls).toHaveBeenCalledWith([jasmine.stringMatching('/severance_s1e4.jpg')]);
      expect(mockTmdbTvSeasons.getTvSeasonDetails).not.toHaveBeenCalled();
    });

    it('should query season details and cache all episode stills', async () => {
      mockStorage.getCachedDoc.and.returnValue(null);
      mockTmdbTvSeasons.getTvSeasonDetails.and.returnValue(of({
        id: 100,
        season_number: 1,
        episodes: [
          { episode_number: 1, still_path: '/s1e1.jpg' },
          { episode_number: 2, still_path: '/s1e2.jpg' },
          { episode_number: 3, still_path: null }
        ]
      }));

      const ep1Url = await service.getEpisodeStillUrl(95396, 1, 1);
      expect(ep1Url).toContain('/s1e1.jpg');
      expect(mockTmdbTvSeasons.getTvSeasonDetails).toHaveBeenCalledWith(95396, 1);

      // Subsequent query for ep 2 should hit in-memory cache without calling API again
      mockTmdbTvSeasons.getTvSeasonDetails.calls.reset();
      const ep2Url = await service.getEpisodeStillUrl(95396, 1, 2);
      expect(ep2Url).toContain('/s1e2.jpg');
      expect(mockTmdbTvSeasons.getTvSeasonDetails).not.toHaveBeenCalled();

      // Query for ep 3 with no still should return null from cache
      const ep3Url = await service.getEpisodeStillUrl(95396, 1, 3);
      expect(ep3Url).toBeNull();
      expect(mockTmdbTvSeasons.getTvSeasonDetails).not.toHaveBeenCalled();
    });

    it('should return null and handle API errors gracefully', async () => {
      mockStorage.getCachedDoc.and.returnValue(null);
      mockTmdbTvSeasons.getTvSeasonDetails.and.returnValue(throwError(() => new Error('Season not found')));

      const url = await service.getEpisodeStillUrl(95396, 99, 1);
      expect(url).toBeNull();
    });
  });
});
