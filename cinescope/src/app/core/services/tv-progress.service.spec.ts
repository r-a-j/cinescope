import { TestBed } from '@angular/core/testing';
import {
    TvProgressService,
    checkEpisodeReleaseStatus
} from './tv-progress.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from './storage.service';
import { TvReleaseIntelService } from './tv-release-intel.service';
import { signal } from '@angular/core';
import { ContentDocType } from '../database/schemas/content.schema';
import {
    TvProgressDocType,
    migrateTvProgressCounts,
    tvProgressSchemaLiteral
} from '../database/schemas/tv-progress.schema';

describe('TV progress schema migration', () => {
    it('migrates existing episode counts without counting specials', () => {
        const oldDoc = {
            id: 'tv_1',
            watchedEpisodesCount: 5,
            watchedEpisodes: ['s0e1', 's1e1', 's1e2', 's1e2', 's2e1']
        };
        const migrated = migrateTvProgressCounts(oldDoc);

        expect(tvProgressSchemaLiteral.version).toBe(2);
        expect(migrated['watchedEpisodesCount']).toBe(3);
        expect(migrated['watchedEpisodes']).toEqual(oldDoc.watchedEpisodes);
    });

    it('recounts marked-complete progress after preserving unwatched regular episodes', () => {
        const migrated = migrateTvProgressCounts({
            isMarkedComplete: true,
            totalEpisodes: 3,
            watchedEpisodes: ['s0e1'],
            unwatchedEpisodes: ['s1e2', 's0e2']
        });

        expect(migrated.watchedEpisodesCount).toBe(2);
        expect(migrated.totalReleasedEpisodes).toBe(3);
    });

    it('defaults totalReleasedEpisodes to totalEpisodes during migration if missing', () => {
        const migrated = migrateTvProgressCounts({
            id: 'tv_1',
            totalEpisodes: 10,
            watchedEpisodes: ['s1e1']
        });

        expect(migrated.totalReleasedEpisodes).toBe(10);
    });

    it('preserves existing totalReleasedEpisodes during migration', () => {
        const migrated = migrateTvProgressCounts({
            id: 'tv_2',
            totalEpisodes: 14,
            totalReleasedEpisodes: 8,
            watchedEpisodes: ['s1e1']
        });

        expect(migrated.totalReleasedEpisodes).toBe(8);
    });
});

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

        const mockReleaseIntelService = {
            intelMap: signal(new Map()),
            getIntelForSeries: jasmine.createSpy('getIntelForSeries').and.returnValue(undefined),
            verifyReleaseDates: jasmine.createSpy('verifyReleaseDates').and.returnValue(Promise.resolve(new Map()))
        };

        TestBed.configureTestingModule({
            providers: [
                TvProgressService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: StorageService, useValue: mockStorageService },
                { provide: TvReleaseIntelService, useValue: mockReleaseIntelService }
            ]
        });

        service = TestBed.inject(TvProgressService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('does not infer a complete series from one watched episode when the total is unknown', async () => {
        await service.markEpisodeWatched(1396, 1, 4);

        const progress = mockUpsert.calls.mostRecent().args[0] as TvProgressDocType;
        expect(progress.watchedEpisodesCount).toBe(1);
        expect(progress.totalEpisodes).toBe(0);
        expect(progress.isMarkedComplete).toBeUndefined();
        expect(service.getUpNextEpisode(1396)).toBeNull();
    });

    it('preserves whole-series completion as an exception when metadata has no season breakdown', async () => {
        mockWatched.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                mediaType: 'tv',
                lists: ['watched'],
                addedAt: '2026-10-30T10:00:00Z',
                payload: {
                    name: 'Breaking Bad',
                    number_of_seasons: 5,
                    number_of_episodes: 62
                }
            }
        ]);

        await service.unmarkEpisodeWatched(1396, 3, 5);

        const progress = mockUpsert.calls.mostRecent().args[0] as TvProgressDocType;
        expect(progress.isMarkedComplete).toBeTrue();
        expect(progress.unwatchedEpisodes).toEqual(['s3e5']);
        expect(progress.watchedEpisodes).toEqual([]);
        expect(progress.watchedEpisodesCount).toBe(61);
    });

    it('turns a newly aired episode into Up Next after refreshing a whole-series completion', async () => {
        service.allProgress.set([
            {
                id: 'tv_1',
                tmdbId: 1,
                seriesTitle: 'Growing Series',
                totalSeasons: 1,
                totalEpisodes: 2,
                watchedEpisodesCount: 2,
                watchedEpisodes: ['s1e1', 's1e2'],
                isMarkedComplete: true,
                unwatchedEpisodes: [],
                updatedAt: Date.now()
            }
        ]);

        await service.syncSeriesMeta({
            adult: false,
            backdrop_path: null,
            created_by: [],
            episode_run_time: [],
            first_air_date: '',
            genres: [],
            homepage: null,
            id: 1,
            in_production: true,
            languages: [],
            last_air_date: '',
            last_episode_to_air: null,
            name: 'Growing Series',
            next_episode_to_air: null,
            networks: [],
            number_of_episodes: 3,
            number_of_seasons: 1,
            origin_country: [],
            original_language: 'en',
            original_name: 'Growing Series',
            overview: '',
            popularity: 0,
            poster_path: null,
            production_companies: [],
            production_countries: [],
            seasons: [{
                id: 1,
                season_number: 1,
                episode_count: 3,
                name: 'Season 1',
                air_date: null,
                overview: '',
                poster_path: null,
                vote_average: 0
            }],
            spoken_languages: [],
            status: 'Returning Series',
            tagline: '',
            type: 'Scripted',
            vote_average: 0,
            vote_count: 0
        });

        const updated = mockUpsert.calls.mostRecent().args[0] as TvProgressDocType;
        expect(updated.isMarkedComplete).toBeUndefined();
        expect(updated.watchedEpisodes).toEqual(['s1e1', 's1e2']);
        expect(updated.watchedEpisodesCount).toBe(2);
        expect(updated.totalEpisodes).toBe(3);

        service.allProgress.set([updated]);
        expect(service.getUpNextEpisode(1)).toEqual({ seasonNumber: 1, episodeNumber: 3 });
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

    it('does not guess Up Next when episode progress is out of order and season data is missing', () => {
        service.allProgress.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                seriesTitle: 'Breaking Bad',
                totalSeasons: 1,
                totalEpisodes: 7,
                watchedEpisodesCount: 3,
                watchedEpisodes: ['s1e4', 's1e5', 's1e6'],
                lastWatchedSeason: 1,
                lastWatchedEpisode: 6,
                updatedAt: Date.now()
            }
        ]);

        expect(service.getUpNextEpisode(1396)).toBeNull();
    });

    it('finds the earliest unwatched episode after out-of-order watches when season data is available', () => {
        service.allProgress.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                seriesTitle: 'Breaking Bad',
                totalSeasons: 1,
                totalEpisodes: 7,
                watchedEpisodesCount: 3,
                watchedEpisodes: ['s1e4', 's1e5', 's1e6'],
                lastWatchedSeason: 1,
                lastWatchedEpisode: 6,
                updatedAt: Date.now()
            }
        ]);

        expect(service.getUpNextEpisode(1396, [
            { id: 1, season_number: 1, episode_count: 7, name: 'Season 1', air_date: null, overview: '', poster_path: null, vote_average: 8 }
        ])).toEqual({ seasonNumber: 1, episodeNumber: 1 });
    });

    it('uses persisted season counts to find the next episode when content metadata is not cached', () => {
        service.allProgress.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                seriesTitle: 'Breaking Bad',
                totalSeasons: 2,
                totalEpisodes: 6,
                watchedEpisodesCount: 2,
                watchedEpisodes: ['s1e1', 's1e2'],
                seasonEpisodeCounts: [
                    { seasonNumber: 1, episodeCount: 2 },
                    { seasonNumber: 2, episodeCount: 4 }
                ],
                updatedAt: Date.now()
            } as TvProgressDocType
        ]);

        expect(service.getUpNextEpisode(1396)).toEqual({ seasonNumber: 2, episodeNumber: 1 });
    });

    it('tracks specials without counting them toward regular episode progress', async () => {
        await service.markEpisodeWatched(1396, 0, 1, {
            title: 'Breaking Bad',
            totalSeasons: 5,
            totalEpisodes: 62
        });

        const doc = mockUpsert.calls.mostRecent().args[0];
        expect(doc.watchedEpisodes).toContain('s0e1');
        expect(doc.watchedEpisodesCount).toBe(0);
    });

    it('unmarks one episode from a whole-series Watched state without losing its other progress', async () => {
        service.allProgress.set([
            {
                id: 'tv_1396',
                tmdbId: 1396,
                seriesTitle: 'Breaking Bad',
                totalSeasons: 1,
                totalEpisodes: 3,
                watchedEpisodesCount: 3,
                watchedEpisodes: ['s0e1'],
                seasonEpisodeCounts: [{ seasonNumber: 1, episodeCount: 3 }],
                isMarkedComplete: true,
                unwatchedEpisodes: [],
                updatedAt: Date.now()
            }
        ]);

        await service.unmarkEpisodeWatched(1396, 1, 2);

        const updated = mockUpsert.calls.mostRecent().args[0];
        expect(updated.isMarkedComplete).toBeTrue();
        expect(updated.unwatchedEpisodes).toEqual(['s1e2']);
        expect(updated.watchedEpisodes).toContain('s0e1');
        expect(updated.watchedEpisodesCount).toBe(2);
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
        expect(doc.totalEpisodes).toBe(20);
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

    describe('Release status guard rails & unreleased episode handling', () => {
        it('identifies episode release status correctly across past, today, tomorrow, and future years', () => {
            const today = '2026-11-01';
            // Past
            expect(checkEpisodeReleaseStatus('2024-05-10', null, null, today).isReleased).toBeTrue();
            // Today
            expect(checkEpisodeReleaseStatus('2026-11-01', null, null, today).isReleased).toBeTrue();
            // Tomorrow
            const tomorrow = checkEpisodeReleaseStatus('2026-11-02', null, null, today);
            expect(tomorrow.isReleased).toBeFalse();
            expect(tomorrow.releaseLabel).toBe('2026-11-02');
            // Future Year 2027
            const future = checkEpisodeReleaseStatus('2027-04-15', null, null, today);
            expect(future.isReleased).toBeFalse();
            expect(future.releaseLabel).toBe('2027-04-15');
            // Year-only 2027
            const futureYear = checkEpisodeReleaseStatus('2027', null, null, today);
            expect(futureYear.isReleased).toBeFalse();
            expect(futureYear.releaseLabel).toBe('2027');
            // TBA / empty air date for in-production or upcoming series
            const tba = checkEpisodeReleaseStatus(null, '2027', 'In Production', today);
            expect(tba.isReleased).toBeFalse();
            expect(tba.releaseLabel).toBe('2027');
            // Missing air date on ended series defaults to released
            const ended = checkEpisodeReleaseStatus(null, '1995-01-01', 'Ended', today);
            expect(ended.isReleased).toBeTrue();
        });

        it('blocks marking future/unreleased episode as watched and does not upsert to db', async () => {
            const result = await service.markEpisodeWatched(555, 2, 1, {
                title: 'Matka King',
                totalSeasons: 2,
                totalEpisodes: 14
            }, '2027-01-15');

            expect(result.success).toBeFalse();
            expect(result.reason).toBe('unreleased');
            expect(result.releaseDate).toBe('2027-01-15');
            expect(mockUpsert).not.toHaveBeenCalled();
        });

        it('allows marking released episode as watched', async () => {
            const result = await service.markEpisodeWatched(555, 1, 8, {
                title: 'Matka King',
                totalSeasons: 2,
                totalEpisodes: 14
            }, '2026-10-15');

            expect(result.success).toBeTrue();
            expect(mockUpsert).toHaveBeenCalled();
        });

        it('syncs multi-season series with unreleased season, setting totalReleasedEpisodes and upcoming season meta', async () => {
            await service.syncSeriesMeta({
                adult: false,
                backdrop_path: '/backdrop.jpg',
                created_by: [],
                episode_run_time: [45],
                first_air_date: '2026-09-01',
                genres: [],
                homepage: '',
                id: 555,
                in_production: true,
                languages: ['hi'],
                last_air_date: '2026-10-20',
                name: 'Matka King',
                networks: [],
                number_of_episodes: 14,
                number_of_seasons: 2,
                origin_country: ['IN'],
                original_language: 'hi',
                original_name: 'Matka King',
                overview: 'A thrilling drama',
                popularity: 45.2,
                poster_path: '/poster.jpg',
                production_companies: [],
                production_countries: [],
                seasons: [
                    {
                        air_date: '2026-09-01',
                        episode_count: 8,
                        id: 101,
                        name: 'Season 1',
                        overview: '',
                        poster_path: null,
                        season_number: 1,
                        vote_average: 8.5
                    },
                    {
                        air_date: '2027-01-15',
                        episode_count: 6,
                        id: 102,
                        name: 'Season 2',
                        overview: '',
                        poster_path: null,
                        season_number: 2,
                        vote_average: 0
                    }
                ],
                spoken_languages: [],
                status: 'Returning Series',
                tagline: '',
                type: 'Scripted',
                vote_average: 8.5,
                vote_count: 120,
                last_episode_to_air: {
                    id: 1008,
                    name: 'Season 1 Finale',
                    overview: '',
                    vote_average: 8.7,
                    vote_count: 50,
                    air_date: '2026-10-20',
                    episode_number: 8,
                    season_number: 1,
                    production_code: 'MK-108',
                    runtime: 45,
                    show_id: 555,
                    still_path: null
                },
                next_episode_to_air: {
                    id: 2001,
                    name: 'Season 2 Premiere',
                    overview: '',
                    vote_average: 0,
                    vote_count: 0,
                    air_date: '2027-01-15',
                    episode_number: 1,
                    season_number: 2,
                    production_code: 'MK-201',
                    runtime: 45,
                    show_id: 555,
                    still_path: null
                }
            });

            expect(mockUpsert).toHaveBeenCalled();
            const doc = mockUpsert.calls.mostRecent().args[0] as TvProgressDocType;
            expect(doc.totalEpisodes).toBe(14);
            expect(doc.totalReleasedEpisodes).toBe(8);
            expect(doc.nextSeasonNumber).toBe(2);
            expect(doc.nextSeasonAirDate).toBe('2027-01-15');
        });

        it('does not return an unreleased future episode in getUpNextEpisode when all released episodes are watched', () => {
            service.allProgress.set([
                {
                    id: 'tv_555',
                    tmdbId: 555,
                    seriesTitle: 'Matka King',
                    totalSeasons: 2,
                    totalEpisodes: 14,
                    totalReleasedEpisodes: 8,
                    watchedEpisodesCount: 8,
                    watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7', 's1e8'],
                    seasonEpisodeCounts: [
                        { seasonNumber: 1, episodeCount: 8 },
                        { seasonNumber: 2, episodeCount: 6 }
                    ],
                    nextSeasonNumber: 2,
                    nextSeasonAirDate: '2027-01-15',
                    nextAirDate: '2027-01-15',
                    nextAirSeason: 2,
                    nextAirEpisode: 1,
                    updatedAt: Date.now()
                }
            ]);

            const seasons = [
                { id: 1, season_number: 1, episode_count: 8, name: 'S1', air_date: '2026-09-01', overview: '', poster_path: null, vote_average: 8.5 },
                { id: 2, season_number: 2, episode_count: 6, name: 'S2', air_date: '2027-01-15', overview: '', poster_path: null, vote_average: 0 }
            ];

            const upNext = service.getUpNextEpisode(555, seasons);
            // S2 E1 is in 2027, so it must NOT be returned as an Up Next episode to watch today!
            expect(upNext).toBeNull();
        });

        it('returns regular Up Next episode if the next episode is already released', () => {
            service.allProgress.set([
                {
                    id: 'tv_555',
                    tmdbId: 555,
                    seriesTitle: 'Matka King',
                    totalSeasons: 2,
                    totalEpisodes: 14,
                    totalReleasedEpisodes: 8,
                    watchedEpisodesCount: 7,
                    watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7'],
                    seasonEpisodeCounts: [
                        { seasonNumber: 1, episodeCount: 8 },
                        { seasonNumber: 2, episodeCount: 6 }
                    ],
                    updatedAt: Date.now()
                }
            ]);

            const seasons = [
                { id: 1, season_number: 1, episode_count: 8, name: 'S1', air_date: '2026-09-01', overview: '', poster_path: null, vote_average: 8.5 },
                { id: 2, season_number: 2, episode_count: 6, name: 'S2', air_date: '2027-01-15', overview: '', poster_path: null, vote_average: 0 }
            ];

            const upNext = service.getUpNextEpisode(555, seasons);
            expect(upNext).toEqual({ seasonNumber: 1, episodeNumber: 8 });
        });

        it('guards markSeasonWatched so unreleased seasons are not marked', async () => {
            const result = await service.markSeasonWatched(555, 2, 6, {
                title: 'Matka King'
            }, '2027-01-15');

            expect(result.success).toBeFalse();
            expect(result.reason).toBe('unreleased');
            expect(mockUpsert).not.toHaveBeenCalled();
        });

        it('keeps series in completedSeries when a season is completed and next season is not released yet', () => {
            const seasonCompletedDoc: TvProgressDocType = {
                id: 'tv_555',
                tmdbId: 555,
                seriesTitle: 'Matka King',
                totalSeasons: 2,
                totalEpisodes: 14,
                totalReleasedEpisodes: 8,
                watchedEpisodesCount: 8,
                watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7', 's1e8'],
                seasonEpisodeCounts: [
                    { seasonNumber: 1, episodeCount: 8 },
                    { seasonNumber: 2, episodeCount: 6 }
                ],
                nextSeasonNumber: 2,
                nextSeasonAirDate: '2027-01-15',
                nextAirDate: '2027-01-15',
                nextAirSeason: 2,
                nextAirEpisode: 1,
                status: 'Returning Series',
                updatedAt: Date.now()
            };

            service.allProgress.set([seasonCompletedDoc]);

            // 1. Must be recognized as complete and awaiting next season
            expect(service.isProgressComplete(seasonCompletedDoc)).toBeTrue();
            expect(service.isAwaitingNextSeason(seasonCompletedDoc)).toBeTrue();
            expect(service.hasUnwatchedReleasedEpisodes(seasonCompletedDoc)).toBeFalse();

            // 2. Must be kept with completed TV series, NOT in currentlyWatching
            expect(service.completedSeries().length).toBe(1);
            expect(service.completedSeries()[0].seriesTitle).toBe('Matka King');
            expect(service.currentlyWatching().length).toBe(0);

            // 3. For upcoming seasons, must be less than a month (<= 31 days) from today
            // 2027-01-15 is > 1 month away, so it does not clutter the < 1 month swimlane
            expect(service.upcomingSeasons().length).toBe(0);

            // 4. When release date is within a month (e.g. in 15 days), it appears in upcoming seasons!
            const now = new Date();
            const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
            const y = in15Days.getFullYear();
            const m = String(in15Days.getMonth() + 1).padStart(2, '0');
            const d = String(in15Days.getDate()).padStart(2, '0');
            const airDate15Days = `${y}-${m}-${d}`;

            service.allProgress.set([{
                ...seasonCompletedDoc,
                nextSeasonAirDate: airDate15Days
            }]);

            const upcomingWithinMonth = service.upcomingSeasons();
            expect(upcomingWithinMonth.length).toBe(1);
            expect(upcomingWithinMonth[0].tmdbId).toBe(555);
            expect(upcomingWithinMonth[0].seasonNumber).toBe(2);
            expect(upcomingWithinMonth[0].seasonAirDate).toBe(airDate15Days);
            expect(upcomingWithinMonth[0].daysUntil).toBe(15);
            expect(upcomingWithinMonth[0].isCaughtUp).toBeTrue();
        });

        it('automatically transitions series back to currentlyWatching as soon as 1st episode of new season is released', () => {
            const seasons = [
                { id: 1, season_number: 1, episode_count: 8, name: 'S1', air_date: '2026-09-01', overview: '', poster_path: null, vote_average: 8.5 },
                { id: 2, season_number: 2, episode_count: 6, name: 'S2', air_date: '2026-11-01', overview: '', poster_path: null, vote_average: 8.0 }
            ];

            // Season 2 Episode 1 just released (air date <= today)!
            const s2ReleasedDoc: TvProgressDocType = {
                id: 'tv_555',
                tmdbId: 555,
                seriesTitle: 'Matka King',
                totalSeasons: 2,
                totalEpisodes: 14,
                totalReleasedEpisodes: 9, // S1 (8) + S2E1 (1)
                watchedEpisodesCount: 8, // User only watched S1
                watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7', 's1e8'],
                seasonEpisodeCounts: [
                    { seasonNumber: 1, episodeCount: 8 },
                    { seasonNumber: 2, episodeCount: 6 }
                ],
                nextAirSeason: 2,
                nextAirEpisode: 2, // Next to air is S2E2
                nextAirDate: '2026-11-08',
                status: 'Returning Series',
                updatedAt: Date.now()
            };

            service.allProgress.set([s2ReleasedDoc]);

            // 1. Must now recognize that released unwatched episodes exist
            expect(service.hasUnwatchedReleasedEpisodes(s2ReleasedDoc)).toBeTrue();
            expect(service.isProgressComplete(s2ReleasedDoc)).toBeFalse();

            // 2. Automatically moves back into currentlyWatching, leaves completedSeries
            expect(service.currentlyWatching().length).toBe(1);
            expect(service.currentlyWatching()[0].seriesTitle).toBe('Matka King');
            expect(service.completedSeries().length).toBe(0);

            // 3. Up Next points directly to Season 2 Episode 1!
            const upNext = service.getUpNextEpisode(555, seasons);
            expect(upNext).toEqual({ seasonNumber: 2, episodeNumber: 1 });
        });

        it('includes upcoming season premiere in airRadar when air date is in the weekly window', () => {
            const now = new Date();
            const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
            const y = inTwoDays.getFullYear();
            const m = String(inTwoDays.getMonth() + 1).padStart(2, '0');
            const d = String(inTwoDays.getDate()).padStart(2, '0');
            const airDateStr = `${y}-${m}-${d}`;

            service.allProgress.set([
                {
                    id: 'tv_777',
                    tmdbId: 777,
                    seriesTitle: 'Severance',
                    totalSeasons: 2,
                    totalEpisodes: 18,
                    totalReleasedEpisodes: 9,
                    watchedEpisodesCount: 9,
                    watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7', 's1e8', 's1e9'],
                    nextSeasonNumber: 2,
                    nextSeasonAirDate: airDateStr,
                    nextSeasonTitle: 'Season 2 Premiere',
                    updatedAt: Date.now()
                }
            ]);

            const radar = service.airRadar();
            expect(radar.length).toBe(1);
            expect(radar[0].tmdbId).toBe(777);
            expect(radar[0].seriesTitle).toBe('Severance');
            expect(radar[0].seasonNumber).toBe(2);
            expect(radar[0].episodeNumber).toBe(1);
            expect(radar[0].daysUntil).toBe(2);
        });

        it('enriches upcoming seasons with Gemini verified release dates and planned years', () => {
            const now = new Date();
            const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
            const y = in20Days.getFullYear();
            const m = String(in20Days.getMonth() + 1).padStart(2, '0');
            const d = String(in20Days.getDate()).padStart(2, '0');
            const verifiedDateStr = `${y}-${m}-${d}`;

            // Stale or missing date in local TMDB doc
            service.allProgress.set([
                {
                    id: 'tv_888',
                    tmdbId: 888,
                    seriesTitle: 'Mirzapur',
                    totalSeasons: 3,
                    totalEpisodes: 30,
                    totalReleasedEpisodes: 30,
                    watchedEpisodesCount: 30,
                    watchedEpisodes: ['s3e10'],
                    nextSeasonNumber: 4,
                    status: 'Returning Series',
                    updatedAt: Date.now()
                }
            ]);

            // Gemini verifies the exact release date within 20 days
            const verifiedMap = new Map();
            verifiedMap.set(888, {
                tmdbId: 888,
                seriesTitle: 'Mirzapur',
                seasonNumber: 4,
                releaseStatus: 'confirmed',
                releaseDate: verifiedDateStr,
                releaseYear: 2026,
                releaseWindow: 'Nov 2026',
                confidence: 'high',
                notes: 'Prime Video announcement'
            });
            service.releaseIntel.intelMap.set(verifiedMap);

            const upcoming = service.upcomingSeasons();
            expect(upcoming.length).toBe(1);
            expect(upcoming[0].tmdbId).toBe(888);
            expect(upcoming[0].seasonAirDate).toBe(verifiedDateStr);
            expect(upcoming[0].daysUntil).toBe(20);
            expect(upcoming[0].plannedReleaseYear).toBe(2026);
            expect(upcoming[0].plannedReleaseWindow).toBe('Nov 2026');
        });
    });
});
