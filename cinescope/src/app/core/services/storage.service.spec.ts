import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { DatabaseService } from '../database/database.service';
import { PosterCacheService } from './poster-cache.service';
import { RegionService } from './region.service';
import { APP_VERSION } from '../constants/app-version';

describe('StorageService - Backup & Restore', () => {
    let service: StorageService;
    let mockContentBulkUpsert: jasmine.Spy;
    let mockTvProgressBulkUpsert: jasmine.Spy;
    let mockSearchHistoryBulkUpsert: jasmine.Spy;
    let mockSettingsUpsert: jasmine.Spy;

    beforeEach(() => {
        mockContentBulkUpsert = jasmine.createSpy('contentBulkUpsert').and.returnValue(Promise.resolve());
        mockTvProgressBulkUpsert = jasmine.createSpy('tvProgressBulkUpsert').and.returnValue(Promise.resolve());
        mockSearchHistoryBulkUpsert = jasmine.createSpy('searchHistoryBulkUpsert').and.returnValue(Promise.resolve());
        mockSettingsUpsert = jasmine.createSpy('settingsUpsert').and.returnValue(Promise.resolve());

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
                    find: jasmine.createSpy('find').and.returnValue(createQueryMock([])),
                    findOne: jasmine.createSpy('findOne').and.returnValue(createQueryMock(null))
                },
                tvProgress: {
                    bulkUpsert: mockTvProgressBulkUpsert,
                    find: jasmine.createSpy('find').and.returnValue(createQueryMock([])),
                    findOne: jasmine.createSpy('findOne').and.returnValue(createQueryMock(null))
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

    it('exports the current frontend package version in backup metadata', async () => {
        const backup = JSON.parse(await service.exportBackupJson()) as { appVersion: string };

        expect(backup.appVersion).toBe(APP_VERSION);
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
                    watchedEpisodesCount: 2,
                    watchedEpisodes: ['s1e1', 's1e2'],
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
    });
});
