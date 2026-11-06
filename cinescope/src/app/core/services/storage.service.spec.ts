import { TestBed } from '@angular/core/testing';
import { checkMediaReleaseStatus, StorageService } from './storage.service';
import { DatabaseService } from '../database/database.service';
import { PosterCacheService } from './poster-cache.service';
import { RegionService } from './region.service';
import { APP_VERSION } from '../constants/app-version';
import { ContentDocType } from '../database/schemas/content.schema';

describe('StorageService - Backup & Restore', () => {
    let service: StorageService;
    let mockContentBulkUpsert: jasmine.Spy;
    let mockTvProgressBulkUpsert: jasmine.Spy;
    let mockSearchHistoryBulkUpsert: jasmine.Spy;
    let mockSettingsUpsert: jasmine.Spy;
    let mockContentFind: jasmine.Spy;
    let mockTvProgressFind: jasmine.Spy;
    let mockContentFindOne: jasmine.Spy;
    let mockTvProgressFindOne: jasmine.Spy;
    let mockTvProgressUpsert: jasmine.Spy;

    beforeEach(() => {
        mockContentBulkUpsert = jasmine.createSpy('contentBulkUpsert').and.returnValue(Promise.resolve());
        mockTvProgressBulkUpsert = jasmine.createSpy('tvProgressBulkUpsert').and.returnValue(Promise.resolve());
        mockSearchHistoryBulkUpsert = jasmine.createSpy('searchHistoryBulkUpsert').and.returnValue(Promise.resolve());
        mockSettingsUpsert = jasmine.createSpy('settingsUpsert').and.returnValue(Promise.resolve());
        mockContentFind = jasmine.createSpy('contentFind');
        mockTvProgressFind = jasmine.createSpy('tvProgressFind');
        mockContentFindOne = jasmine.createSpy('contentFindOne');
        mockTvProgressFindOne = jasmine.createSpy('tvProgressFindOne');
        mockTvProgressUpsert = jasmine.createSpy('tvProgressUpsert').and.returnValue(Promise.resolve());

        const createQueryMock = (docs: unknown = []): { exec: jasmine.Spy; $: { subscribe: () => { unsubscribe: () => void } } } => ({
            exec: jasmine.createSpy('exec').and.returnValue(Promise.resolve(docs)),
            $: {
                subscribe: (): { unsubscribe: () => void } => ({
                    unsubscribe: (): void => undefined
                })
            }
        });

        const mockDatabaseService = {
            isInitialized: (): boolean => true,
            getDatabase: (): Promise<void> => Promise.resolve(),
            db: {
                content: {
                    bulkUpsert: mockContentBulkUpsert,
                    find: mockContentFind.and.returnValue(createQueryMock([])),
                    findOne: mockContentFindOne.and.returnValue(createQueryMock(null)),
                },
                tvProgress: {
                    bulkUpsert: mockTvProgressBulkUpsert,
                    find: mockTvProgressFind.and.returnValue(createQueryMock([])),
                    findOne: mockTvProgressFindOne.and.returnValue(createQueryMock(null)),
                    upsert: mockTvProgressUpsert
                },
                searchHistory: {
                    bulkUpsert: mockSearchHistoryBulkUpsert,
                    find: jasmine.createSpy('find').and.returnValue(createQueryMock([])),
                    findOne: jasmine.createSpy('findOne').and.returnValue(createQueryMock(null))
                },
                settings: {
                    upsert: mockSettingsUpsert,
                    find: jasmine.createSpy('find').and.returnValue(createQueryMock([])),
                    findOne: jasmine.createSpy('findOne').and.returnValue({
                        exec: jasmine.createSpy('exec').and.returnValue(Promise.resolve(null))
                    })
                },
                customPosters: {
                    find: jasmine.createSpy('find').and.returnValue(createQueryMock([]))
                }
            }
        };

        const mockPosterCache = {
            prewarmUrls: jasmine.createSpy('prewarmUrls')
        };

        const mockRegionService = {
            detectRegion: jasmine.createSpy('detectRegion').and.returnValue(Promise.resolve('US'))
        };

        TestBed.configureTestingModule({
            providers: [
                StorageService,
                { provide: DatabaseService, useValue: mockDatabaseService },
                { provide: PosterCacheService, useValue: mockPosterCache },
                { provide: RegionService, useValue: mockRegionService }
            ]
        });

        service = TestBed.inject(StorageService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('marks every known regular TV episode watched while excluding specials', async () => {
        const content = {
            id: 'tv_1396',
            tmdbId: 1396,
            mediaType: 'tv',
            lists: ['watchlist'],
            addedAt: '2026-10-30T10:00:00Z',
            payload: { name: 'Breaking Bad' }
        };
        const contentDoc = {
            toJSON: (): typeof content => content,
            incrementalModify: jasmine.createSpy('incrementalModify').and.callFake(
                async (modify: (data: typeof content) => typeof content): Promise<void> => {
                    modify(content);
                }
            ),
            remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve())
        };
        mockContentFindOne.and.returnValue({ exec: () => Promise.resolve(contentDoc) });
        mockTvProgressFindOne.and.returnValue({ exec: () => Promise.resolve(null) });

        const moved = await service.moveToWatched(1396, 'tv', {
            name: 'Breaking Bad',
            first_air_date: '2008-01-20',
            number_of_seasons: 2,
            number_of_episodes: 3,
            seasons: [
                { season_number: 0, episode_count: 1 },
                { season_number: 1, episode_count: 2 },
                { season_number: 2, episode_count: 1 }
            ]
        });

        expect(moved).toBeTrue();
        const progress = mockTvProgressUpsert.calls.mostRecent().args[0];
        expect(progress.watchedEpisodes).toEqual(['s1e1', 's1e2', 's2e1']);
        expect(progress.watchedEpisodesCount).toBe(3);
        expect(progress.totalEpisodes).toBe(3);
        expect(progress.seasonEpisodeCounts).toEqual([
            { seasonNumber: 1, episodeCount: 2 },
            { seasonNumber: 2, episodeCount: 1 }
        ]);
    });

    it('clears episode progress when a TV show is removed from Watched', async () => {
        const contentDoc = {
            remove: jasmine.createSpy('removeContent').and.returnValue(Promise.resolve())
        };
        const progressDoc = {
            remove: jasmine.createSpy('removeProgress').and.returnValue(Promise.resolve())
        };
        mockContentFindOne.and.returnValue({ exec: () => Promise.resolve(contentDoc) });
        mockTvProgressFindOne.and.returnValue({ exec: () => Promise.resolve(progressDoc) });

        await service.removeFromWatched(1396, 'tv');

        expect(contentDoc.remove).toHaveBeenCalled();
        expect(progressDoc.remove).toHaveBeenCalled();
    });

    it('clears associated TV progress when the Watched list is cleared', async () => {
        const content = {
            id: 'tv_1396',
            tmdbId: 1396,
            mediaType: 'tv',
            lists: ['watched'],
            addedAt: '2026-10-30T10:00:00Z',
            payload: { name: 'Breaking Bad' }
        };
        const contentDoc = {
            toJSON: (): typeof content => content,
            remove: jasmine.createSpy('removeContent').and.returnValue(Promise.resolve())
        };
        const progressDoc = {
            remove: jasmine.createSpy('removeProgress').and.returnValue(Promise.resolve())
        };
        mockContentFind.and.returnValue({ exec: () => Promise.resolve([contentDoc]) });
        mockTvProgressFindOne.and.returnValue({ exec: () => Promise.resolve(progressDoc) });

        expect(await service.clearWatchedList()).toBe(1);
        expect(contentDoc.remove).toHaveBeenCalled();
        expect(progressDoc.remove).toHaveBeenCalled();
    });

    it('clears TV progress when media is bulk-removed even if its content record is missing', async () => {
        const progressDoc = {
            remove: jasmine.createSpy('removeProgress').and.returnValue(Promise.resolve())
        };
        mockContentFind.and.returnValue({ exec: () => Promise.resolve([]) });
        mockTvProgressFindOne.and.returnValue({ exec: () => Promise.resolve(progressDoc) });

        await service.bulkRemoveMedia([1396], 'tv');

        expect(progressDoc.remove).toHaveBeenCalled();
    });

    it('does not move a future movie to Watched, but allows a movie released today', async () => {
        expect(checkMediaReleaseStatus({ release_date: '2026-10-31' }, '2026-10-30').isReleased).toBeFalse();
        expect(checkMediaReleaseStatus({ release_date: '2026-10-30' }, '2026-10-30').isReleased).toBeTrue();
    });

    it('deduplicates person credits and keeps same-number movie and TV credits distinct', () => {
        const watchedItem = (tmdbId: number, mediaType: 'movie' | 'tv'): ContentDocType => ({
            id: `${mediaType}_${tmdbId}`,
            tmdbId,
            mediaType,
            lists: ['watched'],
            addedAt: '2026-10-30T10:00:00Z',
            payload: {}
        });
        service.watchedItems.set([watchedItem(1, 'movie'), watchedItem(1, 'tv')]);

        expect(service.getPersonProgress(['movie_1', 'movie_1', 'tv_1', 'movie_2']))
            .toEqual({ watched: 2, watchlist: 0, total: 3, percent: 67 });
        expect(service.getPersonProgress([])).toEqual({ watched: 0, watchlist: 0, total: 0, percent: 0 });
    });

    it('exports the current frontend package version in backup metadata', async () => {
        const backup = JSON.parse(await service.exportBackupJson()) as { appVersion: string };

        expect(backup.appVersion).toBe(APP_VERSION);
    });

    it('exports tvProgress records including totalReleasedEpisodes and nextSeason details', async () => {
        const mockProgressDoc = {
            toJSON: (): Record<string, unknown> => ({
                id: 'tv_99999',
                tmdbId: 99999,
                seriesTitle: 'Matka King',
                totalSeasons: 2,
                totalEpisodes: 14,
                totalReleasedEpisodes: 8,
                nextSeasonNumber: 2,
                nextSeasonAirDate: '2027-01-01',
                nextSeasonTitle: 'Season 2',
                watchedEpisodesCount: 8,
                watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7', 's1e8'],
                updatedAt: 1730000000000,
                _rev: '1-abc',
                _deleted: false,
                _meta: { lwt: 123 }
            })
        };

        const createQueryMock = (docs: unknown = []): { exec: jasmine.Spy; $: { subscribe: () => { unsubscribe: () => void } } } => ({
            exec: jasmine.createSpy('exec').and.returnValue(Promise.resolve(docs)),
            $: {
                subscribe: (): { unsubscribe: () => void } => ({
                    unsubscribe: jasmine.createSpy('unsubscribe')
                })
            }
        });

        mockTvProgressFind.and.returnValue(createQueryMock([mockProgressDoc]));

        const rawJson = await service.exportBackupJson();
        const backup = JSON.parse(rawJson);

        expect(backup.tvProgress).toBeDefined();
        expect(backup.tvProgress.length).toBe(1);
        const item = backup.tvProgress[0];
        expect(item.id).toBe('tv_99999');
        expect(item.totalReleasedEpisodes).toBe(8);
        expect(item.nextSeasonNumber).toBe(2);
        expect(item.nextSeasonAirDate).toBe('2027-01-01');
        expect(item.nextSeasonTitle).toBe('Season 2');
        expect(item._rev).toBeUndefined();
        expect(item._meta).toBeUndefined();
    });

    it('should inspect modern backup containing content and tvProgress', () => {
        const payload = {
            version: 1,
            appVersion: '1.2.0',
            app: 'CineScope',
            exportedAt: '2026-10-30T12:00:00Z',
            settings: { allowAdultContent: false, theme: 'dark' },
            content: [
                {
                    id: 'movie_550',
                    tmdbId: 550,
                    mediaType: 'movie',
                    lists: ['watchlist'],
                    addedAt: '2026-10-30T10:00:00Z',
                    payload: { title: 'Fight Club' }
                }
            ],
            searchHistory: [],
            tvProgress: [
                {
                    id: 'tv_1396',
                    tmdbId: 1396,
                    seriesTitle: 'Breaking Bad',
                    totalSeasons: 5,
                    totalEpisodes: 62,
                    watchedEpisodesCount: 15,
                    watchedEpisodes: ['s1e1'],
                    updatedAt: Date.now()
                }
            ]
        };

        const inspection = service.inspectBackupJson(JSON.stringify(payload));
        expect(inspection.isValid).toBeTrue();
        expect(inspection.format).toBe('modern');
        expect(inspection.totalTitles).toBe(1);
        expect(inspection.watchlistCount).toBe(1);
        expect(inspection.tvProgressCount).toBe(1);
    });

    it('should validate modern backup containing ONLY tvProgress documents', () => {
        const payload = {
            version: 1,
            exportedAt: '2026-10-30T12:00:00Z',
            content: [],
            tvProgress: [
                {
                    id: 'tv_1396',
                    tmdbId: 1396,
                    seriesTitle: 'Breaking Bad',
                    totalSeasons: 5,
                    totalEpisodes: 62,
                    watchedEpisodesCount: 5,
                    watchedEpisodes: ['s1e1'],
                    updatedAt: Date.now()
                },
                {
                    id: 'tv_60059',
                    tmdbId: 60059,
                    seriesTitle: 'Better Call Saul',
                    totalSeasons: 6,
                    totalEpisodes: 63,
                    watchedEpisodesCount: 10,
                    watchedEpisodes: ['s1e1'],
                    updatedAt: Date.now()
                }
            ]
        };

        const inspection = service.inspectBackupJson(JSON.stringify(payload));
        expect(inspection.isValid).toBeTrue();
        expect(inspection.format).toBe('modern');
        expect(inspection.tvProgressCount).toBe(2);
    });

    it('should return isValid: false for empty or unparseable JSON', () => {
        const result = service.inspectBackupJson('{ invalid json }');
        expect(result.isValid).toBeFalse();
        expect(result.format).toBe('unknown');
    });

    it('should accurately inspect and count universes, franchises, and favorite people', () => {
        const payload = {
            version: 1,
            appVersion: '2.0.1',
            exportedAt: '2026-11-06T12:00:00Z',
            content: [
                {
                    id: 'movie_550',
                    tmdbId: 550,
                    mediaType: 'movie',
                    lists: ['watchlist'],
                    addedAt: '2026-11-01T12:00:00Z'
                },
                {
                    id: 'movie_19404',
                    tmdbId: 19404,
                    mediaType: 'movie',
                    lists: ['watched'],
                    addedAt: '2026-11-01T12:00:00Z',
                    watchedAt: '2026-11-02T12:00:00Z'
                },
                {
                    id: 'person_10297',
                    tmdbId: 10297,
                    mediaType: 'person',
                    lists: ['favorite'],
                    addedAt: '2026-11-01T12:00:00Z'
                },
                {
                    id: 'universe_mcu',
                    tmdbId: 1551266981,
                    mediaType: 'movie',
                    lists: ['universe', 'franchise'],
                    addedAt: '2026-11-01T12:00:00Z'
                },
                {
                    id: 'franchise_422834',
                    tmdbId: 422834,
                    mediaType: 'movie',
                    lists: ['franchise'],
                    addedAt: '2026-11-01T12:00:00Z'
                }
            ],
            tvProgress: [
                {
                    id: 'tv_1396',
                    tmdbId: 1396,
                    seriesTitle: 'Breaking Bad',
                    totalSeasons: 5,
                    totalEpisodes: 62,
                    watchedEpisodesCount: 15,
                    watchedEpisodes: ['s1e1'],
                    updatedAt: Date.now()
                }
            ]
        };

        const inspection = service.inspectBackupJson(JSON.stringify(payload));
        expect(inspection.isValid).toBeTrue();
        expect(inspection.totalTitles).toBe(5);
        expect(inspection.watchlistCount).toBe(1);
        expect(inspection.watchedCount).toBe(1);
        expect(inspection.favoritePeopleCount).toBe(1);
        expect(inspection.savedUniversesCount).toBe(2);
        expect(inspection.tvProgressCount).toBe(1);
    });

    it('should import backup JSON restoring both content and tvProgress records', async () => {
        const payload = {
            version: 1,
            exportedAt: '2026-10-30T12:00:00Z',
            content: [
                {
                    id: 'tv_1396',
                    tmdbId: 1396,
                    mediaType: 'tv',
                    lists: ['watchlist'],
                    addedAt: '2026-10-30T10:00:00Z',
                    payload: { name: 'Breaking Bad' }
                }
            ],
            tvProgress: [
                {
                    id: 'tv_1396',
                    tmdbId: 1396,
                    seriesTitle: 'Breaking Bad',
                    totalSeasons: 5,
                    totalEpisodes: 62,
                    watchedEpisodesCount: 3,
                    watchedEpisodes: ['s0e1', 's1e1', 's1e2'],
                    updatedAt: 1730000000000
                }
            ]
        };

        const importResult = await service.importBackupJson(JSON.stringify(payload));

        expect(mockContentBulkUpsert).toHaveBeenCalled();
        expect(mockTvProgressBulkUpsert).toHaveBeenCalled();
        expect(importResult.contentCount).toBe(1);
        expect(importResult.watchlistCount).toBe(1);
        expect(importResult.tvProgressCount).toBe(1);

        const tvChunk = mockTvProgressBulkUpsert.calls.mostRecent().args[0];
        expect(tvChunk.length).toBe(1);
        expect(tvChunk[0].id).toBe('tv_1396');
        expect(tvChunk[0].tmdbId).toBe(1396);
        expect(tvChunk[0].watchedEpisodesCount).toBe(2);
        expect(tvChunk[0].totalReleasedEpisodes).toBe(62);
    });

    it('should import backup JSON restoring modern v2 tvProgress with unreleased episodes metadata', async () => {
        const payload = {
            version: 1,
            exportedAt: '2026-11-01T12:00:00Z',
            content: [],
            tvProgress: [
                {
                    id: 'tv_99999',
                    tmdbId: 99999,
                    seriesTitle: 'Matka King',
                    totalSeasons: 2,
                    totalEpisodes: 14,
                    totalReleasedEpisodes: 8,
                    nextSeasonNumber: 2,
                    nextSeasonAirDate: '2027-01-01',
                    nextSeasonTitle: 'Season 2',
                    watchedEpisodesCount: 8,
                    watchedEpisodes: ['s1e1', 's1e2', 's1e3', 's1e4', 's1e5', 's1e6', 's1e7', 's1e8'],
                    updatedAt: 1730000000000
                }
            ]
        };

        const importResult = await service.importBackupJson(JSON.stringify(payload));

        expect(mockTvProgressBulkUpsert).toHaveBeenCalled();
        expect(importResult.tvProgressCount).toBe(1);

        const tvChunk = mockTvProgressBulkUpsert.calls.mostRecent().args[0];
        expect(tvChunk.length).toBe(1);
        expect(tvChunk[0].id).toBe('tv_99999');
        expect(tvChunk[0].totalReleasedEpisodes).toBe(8);
        expect(tvChunk[0].nextSeasonNumber).toBe(2);
        expect(tvChunk[0].nextSeasonAirDate).toBe('2027-01-01');
        expect(tvChunk[0].nextSeasonTitle).toBe('Season 2');
        expect(tvChunk[0].watchedEpisodesCount).toBe(8);
    });

    it('should sanitize and sync contradictory payload flags during importBackupJson', async () => {
        const payload = {
            version: 1,
            exportedAt: '2026-11-06T12:00:00Z',
            content: [
                {
                    id: 'movie_19404',
                    tmdbId: 19404,
                    mediaType: 'movie',
                    lists: ['watched'],
                    addedAt: '2026-10-23T14:00:17.073Z',
                    watchedAt: '2026-10-23T14:00:17.073Z',
                    payload: {
                        id: 19404,
                        title: 'Dilwale Dulhania Le Jayenge',
                        isWatched: false,
                        isWatchlist: true
                    }
                },
                {
                    id: 'movie_550',
                    tmdbId: 550,
                    mediaType: 'movie',
                    lists: ['watchlist'],
                    addedAt: '2026-10-23T14:00:17.073Z',
                    payload: {
                        id: 550,
                        title: 'Fight Club',
                        isWatched: true,
                        isWatchlist: false,
                        watchedAt: '2026-10-20T10:00:00.000Z'
                    }
                },
                {
                    id: 'franchise_422834',
                    tmdbId: 422834,
                    mediaType: 'movie',
                    lists: ['franchise'],
                    addedAt: '2026-10-23T14:00:17.073Z',
                    payload: { id: 422834, name: 'Revenge Saga' }
                },
                {
                    id: 'person_10297',
                    tmdbId: 10297,
                    mediaType: 'person',
                    lists: ['favorite'],
                    addedAt: '2026-10-23T14:00:17.073Z',
                    payload: { id: 10297, name: 'Matthew McConaughey' }
                }
            ],
            tvProgress: []
        };

        const result = await service.importBackupJson(JSON.stringify(payload));

        expect(mockContentBulkUpsert).toHaveBeenCalled();
        const contentChunk = mockContentBulkUpsert.calls.mostRecent().args[0];
        expect(contentChunk.length).toBe(4);
        expect(result.contentCount).toBe(4);
        expect(result.watchlistCount).toBe(1);
        expect(result.watchedCount).toBe(1);
        expect(result.savedUniversesCount).toBe(1);
        expect(result.favoritePeopleCount).toBe(1);

        const watchedDoc = contentChunk.find((d: { id: string }) => d.id === 'movie_19404');
        expect(watchedDoc).toBeDefined();
        expect(watchedDoc.payload.isWatched).toBeTrue();
        expect(watchedDoc.payload.isWatchlist).toBeFalse();
        expect(watchedDoc.payload.watchedAt).toBe('2026-10-23T14:00:17.073Z');

        const watchlistDoc = contentChunk.find((d: { id: string }) => d.id === 'movie_550');
        expect(watchlistDoc).toBeDefined();
        expect(watchlistDoc.payload.isWatched).toBeFalse();
        expect(watchlistDoc.payload.isWatchlist).toBeTrue();
        expect(watchlistDoc.payload.watchedAt).toBeUndefined();
    });

    it('should synchronize payload isWatched and isWatchlist flags when moveToWatched is called', async () => {
        const content = {
            id: 'movie_550',
            tmdbId: 550,
            mediaType: 'movie',
            lists: ['watchlist'],
            addedAt: '2026-10-30T10:00:00Z',
            payload: {
                id: 550,
                title: 'Fight Club',
                release_date: '1999-10-15',
                isWatched: false,
                isWatchlist: true
            }
        };
        const contentDoc = {
            toJSON: (): typeof content => content,
            incrementalModify: jasmine.createSpy('incrementalModify').and.callFake(
                async (modify: (data: typeof content) => typeof content): Promise<void> => {
                    modify(content);
                }
            ),
            remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve())
        };
        mockContentFindOne.and.returnValue({ exec: () => Promise.resolve(contentDoc) });

        const moved = await service.moveToWatched(550, 'movie', {
            id: 550,
            title: 'Fight Club',
            release_date: '1999-10-15',
            isWatched: false,
            isWatchlist: true
        });

        expect(moved).toBeTrue();
        expect(content.lists).toEqual(['watched']);
        expect((content.payload as Record<string, unknown>)['isWatched']).toBeTrue();
        expect((content.payload as Record<string, unknown>)['isWatchlist']).toBeFalse();
        expect((content.payload as Record<string, unknown>)['watchedAt']).toBeDefined();
    });

    it('should backfill missing tvProgress records for watched TV series during importBackupJson', async () => {
        const payload = {
            version: 1,
            exportedAt: '2026-11-06T12:00:00Z',
            content: [
                {
                    id: 'tv_93405',
                    tmdbId: 93405,
                    mediaType: 'tv',
                    lists: ['watched'],
                    addedAt: '2025-12-28T20:00:00.000Z',
                    watchedAt: '2025-12-28T20:00:00.000Z',
                    payload: {
                        id: 93405,
                        name: 'Squid Game',
                        status: 'Ended',
                        number_of_seasons: 2,
                        number_of_episodes: 15,
                        seasons: [
                            { season_number: 1, episode_count: 9 },
                            { season_number: 2, episode_count: 6 }
                        ]
                    }
                }
            ],
            tvProgress: [] // Empty in backup!
        };

        const inspection = service.inspectBackupJson(JSON.stringify(payload));
        expect(inspection.tvProgressCount).toBe(1);

        const importResult = await service.importBackupJson(JSON.stringify(payload));
        expect(importResult.tvProgressCount).toBe(1);

        expect(mockTvProgressBulkUpsert).toHaveBeenCalled();
        const tvChunk = mockTvProgressBulkUpsert.calls.mostRecent().args[0];
        expect(tvChunk.length).toBe(1);
        expect(tvChunk[0].id).toBe('tv_93405');
        expect(tvChunk[0].seriesTitle).toBe('Squid Game');
        expect(tvChunk[0].watchedEpisodesCount).toBe(15);
        expect(tvChunk[0].isMarkedComplete).toBeTrue();
        expect(tvChunk[0].watchedEpisodes).toContain('s1e1');
        expect(tvChunk[0].watchedEpisodes).toContain('s2e6');
    });

    it('creates tvProgress when moveInboxToWatched is called for a TV show', async () => {
        const content = {
            id: 'tv_256522',
            tmdbId: 256522,
            mediaType: 'tv',
            lists: ['inbox'],
            addedAt: '2026-10-30T10:00:00Z',
            payload: {
                id: 256522,
                name: 'Bad Cop',
                first_air_date: '2024-06-21',
                number_of_seasons: 1,
                number_of_episodes: 8,
                seasons: [
                    { season_number: 1, episode_count: 8 }
                ]
            }
        };
        const contentDoc = {
            toJSON: (): typeof content => content,
            incrementalModify: jasmine.createSpy('incrementalModify').and.callFake(
                async (modify: (data: typeof content) => typeof content): Promise<void> => {
                    modify(content);
                }
            ),
            remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve())
        };
        mockContentFindOne.and.returnValue({ exec: () => Promise.resolve(contentDoc) });
        mockTvProgressFindOne.and.returnValue({ exec: () => Promise.resolve(null) });

        const moved = await service.moveInboxToWatched(256522, 'tv');
        expect(moved).toBeTrue();
        expect(mockTvProgressUpsert).toHaveBeenCalled();
        const progress = mockTvProgressUpsert.calls.mostRecent().args[0];
        expect(progress.id).toBe('tv_256522');
        expect(progress.seriesTitle).toBe('Bad Cop');
        expect(progress.watchedEpisodesCount).toBe(8);
        expect(progress.isMarkedComplete).toBeTrue();
    });
});
