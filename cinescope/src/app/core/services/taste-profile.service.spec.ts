import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TasteProfileService } from './taste-profile.service';
import { StorageService } from './storage.service';
import { TvProgressService } from './tv-progress.service';
import { DiscoverPreferencesService, DiscoverGenreOption } from './discover-preferences.service';
import { ContentDocType } from '../database/schemas/content.schema';
import { TvProgressDocType } from '../database/schemas/tv-progress.schema';

describe('TasteProfileService', () => {
  let service: TasteProfileService;
  const mockWatched = signal<ContentDocType[]>([]);
  const mockWatchlist = signal<ContentDocType[]>([]);
  const mockFavPeople = signal<ContentDocType[]>([]);
  const mockTvProgress = signal<TvProgressDocType[]>([]);
  const mockPrefLangs = signal<string[]>(['hi', 'en']);
  const mockPrefGenres = signal<DiscoverGenreOption[]>([]);
  const mockAllowAdult = signal<boolean>(false);

  beforeEach(() => {
    mockWatched.set([]);
    mockWatchlist.set([]);
    mockFavPeople.set([]);
    mockTvProgress.set([]);
    mockPrefLangs.set(['hi', 'en']);
    mockPrefGenres.set([]);
    mockAllowAdult.set(false);

    TestBed.configureTestingModule({
      providers: [
        TasteProfileService,
        {
          provide: StorageService,
          useValue: {
            watchedItems: mockWatched,
            watchlistItems: mockWatchlist,
            favoritePeople: mockFavPeople,
            allowAdultContent: mockAllowAdult
          }
        },
        {
          provide: TvProgressService,
          useValue: {
            allProgress: mockTvProgress
          }
        },
        {
          provide: DiscoverPreferencesService,
          useValue: {
            preferredLanguages: mockPrefLangs,
            selectedGenreOptions: mockPrefGenres
          }
        }
      ]
    });
    service = TestBed.inject(TasteProfileService);
  });

  it('rejects low-rated obscure items (vote_average < 5.5) from topSeeds', () => {
    mockWatched.set([
      {
        id: 'movie_24428',
        tmdbId: 24428,
        mediaType: 'movie',
        lists: ['watched'],
        addedAt: '2026-11-01T20:00:00Z',
        payload: {
          id: 24428,
          title: 'The Avengers',
          vote_average: 8.1,
          release_date: '2012-05-04'
        }
      },
      {
        id: 'movie_1453407',
        tmdbId: 1453407,
        mediaType: 'movie',
        lists: ['watched'],
        addedAt: '2026-11-01T20:30:00Z',
        payload: {
          id: 1453407,
          title: 'Gajab Raat',
          vote_average: 4.3,
          release_date: '2024-01-01'
        }
      }
    ]);

    const profile = service.profile();
    const seedIds = profile.topSeeds.map((s) => s.tmdbId);

    expect(seedIds).toContain(24428);
    expect(seedIds).not.toContain(1453407);
  });

  it('infers English for Latin titles without original_language instead of falling back to default hi', () => {
    mockWatched.set([
      {
        id: 'movie_269149',
        tmdbId: 269149,
        mediaType: 'movie',
        lists: ['watched'],
        addedAt: '2026-11-01T20:00:00Z',
        payload: {
          id: 269149,
          title: 'Zootopia',
          vote_average: 7.8,
          release_date: '2016-03-04'
          // note: original_language is undefined, as in legacy backups
        }
      }
    ]);

    const profile = service.profile();
    const zootopiaSeed = profile.topSeeds.find((s) => s.tmdbId === 269149);

    expect(zootopiaSeed).toBeDefined();
    expect(zootopiaSeed?.originalLanguage).toBe('en');
  });

  it('infers Hindi for titles with Indic script when original_language is undefined', () => {
    mockWatched.set([
      {
        id: 'movie_999999',
        tmdbId: 999999,
        mediaType: 'movie',
        lists: ['watched'],
        addedAt: '2026-11-01T20:00:00Z',
        payload: {
          id: 999999,
          title: 'दंगल',
          vote_average: 8.4,
          release_date: '2016-12-23'
        }
      }
    ]);

    const profile = service.profile();
    const dangalSeed = profile.topSeeds.find((s) => s.tmdbId === 999999);

    expect(dangalSeed).toBeDefined();
    expect(dangalSeed?.originalLanguage).toBe('hi');
  });

  it('always excludes 18+ adult items from AI topSeeds even when allowAdultContent is true', () => {
    mockAllowAdult.set(true);
    mockWatched.set([
      {
        id: 'movie_1818',
        tmdbId: 1818,
        mediaType: 'movie',
        lists: ['watched'],
        addedAt: '2026-11-01T20:00:00Z',
        payload: {
          id: 1818,
          title: 'Adult Feature',
          vote_average: 8.5,
          adult: true,
          release_date: '2020-01-01'
        }
      }
    ]);

    const profile = service.profile();
    const adultSeed = profile.topSeeds.find((s) => s.tmdbId === 1818);
    expect(adultSeed).toBeUndefined();
  });

  it('dampens weight for bulk dump when many items are logged in the same 2-hour burst session', () => {
    // 6 items logged simultaneously at 2026-11-01T20:00:00Z
    const burstDocs: ContentDocType[] = [1, 2, 3, 4, 5, 6].map((idx) => ({
      id: `movie_${100 + idx}`,
      tmdbId: 100 + idx,
      mediaType: 'movie',
      lists: ['watched'],
      addedAt: '2026-11-01T20:00:00Z',
      payload: {
        id: 100 + idx,
        title: `Burst Movie ${idx}`,
        vote_average: 7.5,
        release_date: '2025-01-01',
        genre_ids: [28]
      }
    }));

    // 1 isolated item logged days apart
    const isolatedDoc: ContentDocType = {
      id: 'movie_999',
      tmdbId: 999,
      mediaType: 'movie',
      lists: ['watched'],
      addedAt: '2026-10-15T12:00:00Z',
      payload: {
        id: 999,
        title: 'Deliberate Single Watch',
        vote_average: 7.5,
        release_date: '2025-01-01',
        genre_ids: [878]
      }
    };

    mockWatched.set([...burstDocs, isolatedDoc]);
    const profile = service.profile();

    const burstSeed = profile.topSeeds.find((s) => s.tmdbId === 101);
    expect(burstSeed).toBeDefined();

    // The burst seed weight should have the burstMultiplier (< 1.0) applied
    // 6 items in 2h cluster -> burstMultiplier = 1 / sqrt(6 / 3) = 1 / 1.414 ≈ 0.71
    expect(burstSeed!.weight).toBeLessThan(2.5);
  });

  it('applies vintage backlog dampening for historical titles released years before logging', () => {
    // Recent release logged contemporary
    const recentDoc: ContentDocType = {
      id: 'movie_2025',
      tmdbId: 2025,
      mediaType: 'movie',
      lists: ['watched'],
      addedAt: '2026-11-01T20:00:00Z',
      payload: {
        id: 2025,
        title: 'Modern Film',
        vote_average: 7.5,
        release_date: '2025-06-01'
      }
    };

    // 1994 classic logged in 2026 without explicit watch date
    const vintageDoc: ContentDocType = {
      id: 'movie_1994',
      tmdbId: 1994,
      mediaType: 'movie',
      lists: ['watched'],
      addedAt: '2026-11-01T20:00:00Z',
      payload: {
        id: 1994,
        title: 'Classic 90s Film',
        vote_average: 7.5,
        release_date: '1994-06-01'
      }
    };

    mockWatched.set([recentDoc, vintageDoc]);
    const profile = service.profile();

    const modernSeed = profile.topSeeds.find((s) => s.tmdbId === 2025);
    const vintageSeed = profile.topSeeds.find((s) => s.tmdbId === 1994);

    expect(modernSeed).toBeDefined();
    expect(vintageSeed).toBeDefined();
    // Vintage backlog item is damped compared to contemporary watch
    expect(vintageSeed!.weight).toBeLessThan(modernSeed!.weight);
  });

  it('caps primary genre redundancy so a backlog dump of one genre cannot dominate top seed slots', () => {
    // 8 comedy movies
    const comedyDocs: ContentDocType[] = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
      id: `movie_c_${i}`,
      tmdbId: 1000 + i,
      mediaType: 'movie',
      lists: ['watched'],
      addedAt: '2026-11-01T20:00:00Z',
      payload: {
        id: 1000 + i,
        title: `Comedy Title ${i}`,
        vote_average: 8.0,
        release_date: '2025-01-01',
        genre_ids: [35] // Comedy
      }
    }));

    // 2 sci-fi movies
    const scifiDocs: ContentDocType[] = [1, 2].map((i) => ({
      id: `movie_s_${i}`,
      tmdbId: 2000 + i,
      mediaType: 'movie',
      lists: ['watched'],
      addedAt: '2026-11-01T20:00:00Z',
      payload: {
        id: 2000 + i,
        title: `SciFi Title ${i}`,
        vote_average: 7.6,
        release_date: '2025-01-01',
        genre_ids: [878] // SciFi
      }
    }));

    mockWatched.set([...comedyDocs, ...scifiDocs]);
    const profile = service.profile();

    // Top seeds must contain Sci-Fi seeds even though comedies had higher ratings and volume
    const scifiSeeds = profile.topSeeds.filter((s) => s.genreIds.includes(878));
    expect(scifiSeeds.length).toBeGreaterThanOrEqual(1);
  });
});
