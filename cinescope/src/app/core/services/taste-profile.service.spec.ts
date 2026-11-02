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

  beforeEach(() => {
    mockWatched.set([]);
    mockWatchlist.set([]);
    mockFavPeople.set([]);
    mockTvProgress.set([]);
    mockPrefLangs.set(['hi', 'en']);
    mockPrefGenres.set([]);

    TestBed.configureTestingModule({
      providers: [
        TasteProfileService,
        {
          provide: StorageService,
          useValue: {
            watchedItems: mockWatched,
            watchlistItems: mockWatchlist,
            favoritePeople: mockFavPeople
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
});
