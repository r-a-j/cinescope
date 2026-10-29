import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppTourService } from './app-tour.service';
import { DatabaseService } from '../database/database.service';
import { migrateSettingsTourFlag } from '../database/schemas/settings.schema';
import { TrendingStore } from '../store/trending.store';
import { FranchiseAggregatorService } from './franchise-aggregator.service';

describe('AppTourService', () => {
    let service: AppTourService;
    let router: { url: string; navigateByUrl: jasmine.Spy };
    let settings: { appTourCompleted: boolean };
    let database: { getDatabase: jasmine.Spy };
    let incrementalPatch: jasmine.Spy;
    let trendingStore: { loadTrendingData: jasmine.Spy; error: jasmine.Spy };
    let franchises: {
        id: string | number;
        name: string;
        isUniverse?: boolean;
        universeId?: string;
        siblingFranchises?: { id: number; name: string }[];
        mergedSubCollectionIds?: number[];
    }[];
    let franchiseAggregator: { activeUserFranchises: jasmine.Spy };

    beforeEach(() => {
        router = {
            url: '/tabs/discover',
            navigateByUrl: jasmine.createSpy('navigateByUrl').and.callFake(async (url: string) => {
                router.url = url;
                return true;
            })
        };
        settings = { appTourCompleted: false };
        incrementalPatch = jasmine.createSpy('incrementalPatch').and.callFake(async (updates: Partial<typeof settings>) => {
            Object.assign(settings, updates);
        });
        const collection = {
            findOne: jasmine.createSpy('findOne').and.returnValue({
                exec: jasmine.createSpy('exec').and.callFake(async () => ({
                    get appTourCompleted(): boolean {
                        return settings.appTourCompleted;
                    },
                    incrementalPatch
                }))
            })
        };
        database = {
            getDatabase: jasmine.createSpy('getDatabase').and.resolveTo({ settings: collection })
        };
        trendingStore = {
            loadTrendingData: jasmine.createSpy('loadTrendingData').and.resolveTo(),
            error: jasmine.createSpy('error').and.returnValue(null)
        };
        franchises = [];
        franchiseAggregator = {
            activeUserFranchises: jasmine.createSpy('activeUserFranchises').and.callFake(() => franchises)
        };

        TestBed.configureTestingModule({
            providers: [
                AppTourService,
                { provide: Router, useValue: router },
                { provide: DatabaseService, useValue: database },
                { provide: TrendingStore, useValue: trendingStore },
                { provide: FranchiseAggregatorService, useValue: franchiseAggregator }
            ]
        });
        service = TestBed.inject(AppTourService);
    });

    it('waits for Discover content to load before starting the first-run tutorial', async () => {
        let finishLoading!: () => void;
        trendingStore.loadTrendingData.and.returnValue(new Promise<void>(resolve => {
            finishLoading = resolve;
        }));

        const startPromise = service.startFirstRun();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(trendingStore.loadTrendingData).toHaveBeenCalled();
        expect(service.isActive()).toBeFalse();

        finishLoading();
        await startPromise;

        expect(service.isActive()).toBeTrue();
    });

    it('does not redirect users who leave Discover while its first-run feed is loading', async () => {
        let finishLoading!: () => void;
        trendingStore.loadTrendingData.and.returnValue(new Promise<void>(resolve => {
            finishLoading = resolve;
        }));

        const startPromise = service.startFirstRun();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        router.url = '/tabs/movies';
        finishLoading();
        await startPromise;

        expect(service.isActive()).toBeFalse();
        expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('starts the full tour only when first-run settings say it is incomplete', async () => {
        await service.startFirstRun();

        expect(service.isActive()).toBeTrue();
        expect(service.currentStep()?.target).toBe('header-search');
        expect(service.totalSteps()).toBeGreaterThan(1);
    });

    it('does not start the full tour when first-run settings say it is complete', async () => {
        settings.appTourCompleted = true;
        await service.startFirstRun();

        expect(service.isActive()).toBeFalse();
        expect(trendingStore.loadTrendingData).not.toHaveBeenCalled();
    });

    it('does not start the first-run tutorial when Discover fails to load', async () => {
        trendingStore.error.and.returnValue('Failed to load feed.');

        await service.startFirstRun();

        expect(service.isActive()).toBeFalse();
    });

    it('navigates through a module tour and returns to the launch screen', async () => {
        router.url = '/settings';

        await service.start('inbox');
        expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/inbox');
        expect(service.currentStep()?.target).toBe('inbox-import');

        await service.next();
        expect(service.currentStep()?.target).toBe('inbox-queue');

        await service.next();
        expect(service.isActive()).toBeFalse();
        expect(router.navigateByUrl).toHaveBeenCalledWith('/settings');
        expect(incrementalPatch).not.toHaveBeenCalled();
    });

    it('adds focused franchise guidance for an already tracked saga', async () => {
        franchises = [{ id: 'universe_42', name: 'Connected Sagas' }];
        router.url = '/settings';

        await service.start('franchise');

        expect(service.totalSteps()).toBe(7);
        expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/archive?tour=franchise');

        await service.next();
        await service.next();
        await service.next();

        expect(router.navigateByUrl).toHaveBeenCalledWith('/collection/universe_42');
        expect(service.currentStep()?.target).toBe('franchise-actions');
    });

    it('guides users without tracked sagas to the franchise search entry point', async () => {
        await service.start('franchise');

        expect(service.totalSteps()).toBe(3);
        await service.next();
        await service.next();

        expect(router.navigateByUrl).toHaveBeenCalledWith('/search');
        expect(service.currentStep()?.target).toBe('search-input');
    });

    it('guides users through merging and explains where the saga appears', async () => {
        franchises = [{
            id: 'universe_777',
            name: 'Connected Universe',
            isUniverse: true,
            siblingFranchises: [{ id: 42, name: 'Example Saga' }],
            mergedSubCollectionIds: []
        }];

        await service.start('franchise-merge');

        expect(service.totalSteps()).toBe(4);
        await service.next();
        expect(router.navigateByUrl).toHaveBeenCalledWith('/collection/42');
        expect(service.currentStep()?.target).toBe('franchise-merge-toggle');

        await service.next();
        expect(router.navigateByUrl).toHaveBeenCalledWith('/collection/universe_777');
        expect(service.currentStep()?.target).toBe('franchise-progress');

        await service.next();
        expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/archive?tour=franchise-merge');
        expect(service.currentStep()?.description).toContain('top-level card');
    });

    it('guides users through unmerging an already folded saga', async () => {
        franchises = [{
            id: 'universe_777',
            name: 'Connected Universe',
            isUniverse: true,
            mergedSubCollectionIds: [42]
        }];

        await service.start('franchise-merge');
        await service.next();

        expect(router.navigateByUrl).toHaveBeenCalledWith('/collection/42');
        expect(service.currentStep()?.title).toContain('Unmerge');
        expect(service.currentStep()?.description).toContain('return as a standalone Archive entry');
    });

    it('marks the full tour complete when it is skipped', async () => {
        await service.start('app');
        await service.skip();

        expect(incrementalPatch).toHaveBeenCalledWith({ appTourCompleted: true });
        expect(service.isActive()).toBeFalse();

        await service.startFirstRun();
        expect(service.isActive()).toBeFalse();
    });

    it('treats settings upgraded from an older schema as already onboarded', () => {
        const migrated = migrateSettingsTourFlag({
            id: 'user_preferences',
            region: 'IN'
        });

        expect(migrated['appTourCompleted']).toBeTrue();
    });
});
