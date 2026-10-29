import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppTourService } from './app-tour.service';
import { DatabaseService } from '../database/database.service';
import { migrateSettingsTourFlag } from '../database/schemas/settings.schema';
import { TrendingStore } from '../store/trending.store';

describe('AppTourService', () => {
    let service: AppTourService;
    let router: { url: string; navigateByUrl: jasmine.Spy };
    let settings: { appTourCompleted: boolean };
    let database: { getDatabase: jasmine.Spy };
    let incrementalPatch: jasmine.Spy;
    let trendingStore: { loadTrendingData: jasmine.Spy; error: jasmine.Spy };

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

        TestBed.configureTestingModule({
            providers: [
                AppTourService,
                { provide: Router, useValue: router },
                { provide: DatabaseService, useValue: database },
                { provide: TrendingStore, useValue: trendingStore }
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
