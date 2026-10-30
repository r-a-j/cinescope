import { TestBed } from '@angular/core/testing';
import { TvProgressService } from './tv-progress.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from './storage.service';
import { signal } from '@angular/core';
import { ContentDocType } from '../database/schemas/content.schema';

describe('TvProgressService', () => {
    let service: TvProgressService;
    let mockUpsert: jasmine.Spy;
    let mockWatchlist: ReturnType<typeof signal<ContentDocType[]>>;
    let mockWatched: ReturnType<typeof signal<ContentDocType[]>>;

    beforeEach(() => {
        mockUpsert = jasmine.createSpy('upsert').and.returnValue(Promise.resolve());
        mockWatchlist = signal<ContentDocType[]>([]);
        mockWatched = signal<ContentDocType[]>([]);

        const mockDatabaseService = {
            isInitialized: (): boolean => true,
            getDatabase: (): Promise<void> => Promise.resolve(),
            db: {
                tvProgress: {
                    upsert: mockUpsert,
                    find: (): { $: { subscribe: () => { unsubscribe: () => void } } } => ({
                        $: {
                            subscribe: (): { unsubscribe: () => void } => ({
                                unsubscribe: (): void => undefined
                            })
                        }
                    })
                }
            }
        };

        const mockStorageService = {
            watchlistItems: mockWatchlist,
            watchedItems: mockWatched,
            getCachedDoc: jasmine.createSpy('getCachedDoc').and.returnValue(null)
        };

        TestBed.configureTestingModule({
            providers: [
                TvProgressService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: StorageService, useValue: mockStorageService }
            ]
        });

        service = TestBed.inject(TvProgressService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should generate and parse episode keys correctly', () => {
        const key = service.getEpisodeKey(2, 5);
        expect(key).toBe('s2e5');

        const parsed = service.parseEpisodeKey('s3e12');
        expect(parsed).toEqual({ season: 3, episode: 12 });

        expect(service.parseEpisodeKey('invalid')).toBeNull();
    });

    it('should mark an episode watched and invoke db upsert', async () => {
        await service.markEpisodeWatched(1396, 1, 1, {
            title: 'Breaking Bad',
            totalSeasons: 5,
            totalEpisodes: 62
        });

        expect(mockUpsert).toHaveBeenCalled();
        const doc = mockUpsert.calls.mostRecent().args[0];
        expect(doc.id).toBe('tv_1396');
        expect(doc.tmdbId).toBe(1396);
        expect(doc.seriesTitle).toBe('Breaking Bad');
        expect(doc.watchedEpisodes).toContain('s1e1');
        expect(doc.lastWatchedSeason).toBe(1);
        expect(doc.lastWatchedEpisode).toBe(1);
        expect(doc.watchedEpisodesCount).toBe(1);
    });

    it('should mark a full season watched', async () => {
        await service.markSeasonWatched(1396, 1, 7, {
            title: 'Breaking Bad',
            totalSeasons: 5,
            totalEpisodes: 62
        });

        expect(mockUpsert).toHaveBeenCalled();
        const doc = mockUpsert.calls.mostRecent().args[0];
        expect(doc.watchedEpisodes.length).toBe(7);
        expect(doc.watchedEpisodes).toContain('s1e1');
        expect(doc.watchedEpisodes).toContain('s1e7');
        expect(doc.lastWatchedSeason).toBe(1);
        expect(doc.lastWatchedEpisode).toBe(7);
    });

    it('should compute Up Next episode correctly across seasons', () => {
        // Mock progress state
        service.allProgress.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                seriesTitle: 'Breaking Bad',
                totalSeasons: 2,
                totalEpisodes: 20,
                watchedEpisodesCount: 2,
                watchedEpisodes: ['s1e1', 's1e2'],
                updatedAt: Date.now()
            }
        ]);

        const seasons = [
            { id: 1, season_number: 1, episode_count: 7, name: 'Season 1', air_date: null, overview: '', poster_path: null, vote_average: 8 },
            { id: 2, season_number: 2, episode_count: 13, name: 'Season 2', air_date: null, overview: '', poster_path: null, vote_average: 8 }
        ];

        // Next should be Season 1 Episode 3
        const upNext = service.getUpNextEpisode(1396, seasons);
        expect(upNext).toEqual({ seasonNumber: 1, episodeNumber: 3 });
    });

    it('should compute Up Next across to Season 2 when Season 1 is complete', () => {
        service.allProgress.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                seriesTitle: 'Breaking Bad',
                totalSeasons: 2,
                totalEpisodes: 20,
                watchedEpisodesCount: 7,
                watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7'],
                updatedAt: Date.now()
            }
        ]);

        const seasons = [
            { id: 1, season_number: 1, episode_count: 7, name: 'Season 1', air_date: null, overview: '', poster_path: null, vote_average: 8 },
            { id: 2, season_number: 2, episode_count: 13, name: 'Season 2', air_date: null, overview: '', poster_path: null, vote_average: 8 }
        ];

        // Next should advance to Season 2 Episode 1
        const upNext = service.getUpNextEpisode(1396, seasons);
        expect(upNext).toEqual({ seasonNumber: 2, episodeNumber: 1 });
    });

    it('should identify watchlist series ready to start when untracked', () => {
        mockWatchlist.set([
            {
                id: 'tv_60059',
                tmdbId: 60059,
                mediaType: 'tv',
                lists: ['watchlist'],
                addedAt: '2026-10-30T10:00:00Z',
                payload: {
                    name: 'Better Call Saul',
                    number_of_seasons: 6,
                    number_of_episodes: 63
                }
            }
        ]);

        const ready = service.watchlistReadyToStart();
        expect(ready.length).toBe(1);
        expect(ready[0].tmdbId).toBe(60059);
        expect(ready[0].title).toBe('Better Call Saul');
        expect(ready[0].totalSeasons).toBe(6);
    });

    it('should classify series into currentlyWatching and completedSeries', () => {
        service.allProgress.set([
            {
                id: 'tv_1',
                tmdbId: 1,
                seriesTitle: 'In Progress Show',
                totalSeasons: 2,
                totalEpisodes: 20,
                watchedEpisodesCount: 5,
                watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5'],
                updatedAt: Date.now()
            },
            {
                id: 'tv_2',
                tmdbId: 2,
                seriesTitle: 'Completed Show',
                totalSeasons: 1,
                totalEpisodes: 10,
                watchedEpisodesCount: 10,
                watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7', 's1e8', 's1e9', 's1e10'],
                updatedAt: Date.now()
            }
        ]);

        expect(service.currentlyWatching().length).toBe(1);
        expect(service.currentlyWatching()[0].seriesTitle).toBe('In Progress Show');

        expect(service.completedSeries().length).toBe(1);
        expect(service.completedSeries()[0].seriesTitle).toBe('Completed Show');
    });

    it('should auto-hydrate progress when unmarking an episode on a previously watched series', async () => {
        mockWatched.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                mediaType: 'tv',
                lists: ['watched'],
                addedAt: '2026-10-30T10:00:00Z',
                payload: {
                    name: 'Breaking Bad',
                    number_of_seasons: 2,
                    number_of_episodes: 20,
                    seasons: [
                        { id: 1, season_number: 1, episode_count: 7 },
                        { id: 2, season_number: 2, episode_count: 13 }
                    ]
                }
            }
        ]);

        // Series has no tvProgress doc initially
        expect(service.getSeriesProgress(1396)).toBeUndefined();

        // User unmarks Season 2 Episode 13
        await service.unmarkEpisodeWatched(1396, 2, 13);

        expect(mockUpsert).toHaveBeenCalled();
        const doc = mockUpsert.calls.mostRecent().args[0];
        expect(doc.tmdbId).toBe(1396);
        expect(doc.watchedEpisodesCount).toBe(19);
        expect(doc.watchedEpisodes).not.toContain('s2e13');
        expect(doc.watchedEpisodes).toContain('s2e12');
        expect(doc.lastWatchedSeason).toBe(2);
        expect(doc.lastWatchedEpisode).toBe(12);
    });

    it('should recalculate last watched episode and season when unmarking a season', async () => {
        service.allProgress.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                seriesTitle: 'Breaking Bad',
                totalSeasons: 2,
                totalEpisodes: 20,
                watchedEpisodesCount: 20,
                lastWatchedSeason: 2,
                lastWatchedEpisode: 13,
                watchedEpisodes: [
                    's1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7',
                    's2e1', 's2e2', 's2e3', 's2e4', 's2e5', 's2e6', 's2e7', 's2e8', 's2e9', 's2e10', 's2e11', 's2e12', 's2e13'
                ],
                updatedAt: Date.now()
            }
        ]);

        // Unmark season 2
        await service.unmarkSeasonWatched(1396, 2, 13);

        expect(mockUpsert).toHaveBeenCalled();
        const doc = mockUpsert.calls.mostRecent().args[0];
        expect(doc.watchedEpisodesCount).toBe(7);
        expect(doc.watchedEpisodes).not.toContain('s2e1');
        expect(doc.lastWatchedSeason).toBe(1);
        expect(doc.lastWatchedEpisode).toBe(7);
    });

    it('should include upcoming watchlist episodes in airRadar and exclude watched episodes', () => {
        const now = new Date();
        const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const y = inThreeDays.getFullYear();
        const m = String(inThreeDays.getMonth() + 1).padStart(2, '0');
        const d = String(inThreeDays.getDate()).padStart(2, '0');
        const airDateStr = `${y}-${m}-${d}`;

        mockWatchlist.set([
            {
                id: 'tv_999',
                tmdbId: 999,
                mediaType: 'tv',
                lists: ['watchlist'],
                addedAt: '2026-10-30T10:00:00Z',
                payload: {
                    name: 'Upcoming Show',
                    next_episode_to_air: {
                        id: 101,
                        name: 'Chapter Next',
                        air_date: airDateStr,
                        season_number: 1,
                        episode_number: 1
                    }
                }
            }
        ]);

        const radar = service.airRadar();
        expect(radar.length).toBe(1);
        expect(radar[0].tmdbId).toBe(999);
        expect(radar[0].seriesTitle).toBe('Upcoming Show');
        expect(radar[0].seasonNumber).toBe(1);
        expect(radar[0].episodeNumber).toBe(1);
    });
});
