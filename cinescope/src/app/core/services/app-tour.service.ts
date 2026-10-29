import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_TOURS, AppTourId, AppTourStep } from '../constants/app-tour.constants';
import { DatabaseService } from '../database/database.service';
import { TrendingStore } from '../store/trending.store';

interface AppTourSession {
    id: AppTourId;
    steps: AppTourStep[];
    returnUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AppTourService {
    private readonly router = inject(Router);
    private readonly database = inject(DatabaseService);
    private readonly trendingStore = inject(TrendingStore);

    private readonly session = signal<AppTourSession | null>(null);
    private readonly stepIndex = signal(0);

    public readonly isActive = computed(() => this.session() !== null);
    public readonly isNavigating = signal(false);
    public readonly currentStep = computed(() => {
        const session = this.session();
        return session?.steps[this.stepIndex()] ?? null;
    });
    public readonly currentStepNumber = computed(() => this.stepIndex() + 1);
    public readonly totalSteps = computed(() => this.session()?.steps.length ?? 0);
    public readonly canGoBack = computed(() => this.stepIndex() > 0);

    public async start(id: AppTourId): Promise<void> {
        if (this.session()) {
            throw new Error('A CineScope tutorial is already in progress.');
        }

        const definition = APP_TOURS[id];
        if (!definition || definition.steps.length === 0) {
            throw new Error(`No tutorial steps are configured for "${id}".`);
        }

        const returnUrl = this.router.url || '/tabs/discover';
        this.isNavigating.set(true);
        try {
            await this.navigateTo(definition.steps[0].route);
            this.stepIndex.set(0);
            this.session.set({ id, steps: definition.steps, returnUrl });
        } finally {
            this.isNavigating.set(false);
        }
    }

    public async startFirstRun(): Promise<void> {
        const database = await this.database.getDatabase();
        const settings = await database.settings.findOne('user_preferences').exec();
        if (!settings) {
            throw new Error('App settings are unavailable; the first-run tutorial cannot be checked.');
        }

        if (settings.appTourCompleted) return;

        await this.trendingStore.loadTrendingData();
        if (this.trendingStore.error()) return;

        await this.start('app');
    }

    public async next(): Promise<void> {
        const session = this.session();
        if (!session) return;

        const nextIndex = this.stepIndex() + 1;
        if (nextIndex >= session.steps.length) {
            await this.finish();
            return;
        }

        await this.moveToStep(session, nextIndex);
    }

    public async previous(): Promise<void> {
        const session = this.session();
        if (!session || this.stepIndex() === 0) return;

        await this.moveToStep(session, this.stepIndex() - 1);
    }

    public async skip(): Promise<void> {
        await this.finish();
    }

    private async moveToStep(session: AppTourSession, index: number): Promise<void> {
        this.isNavigating.set(true);
        try {
            await this.navigateTo(session.steps[index].route);
            this.stepIndex.set(index);
        } finally {
            this.isNavigating.set(false);
        }
    }

    private async navigateTo(route: string): Promise<void> {
        if (this.router.url === route) return;
        const navigated = await this.router.navigateByUrl(route);
        if (!navigated) {
            throw new Error(`Could not navigate to tutorial section "${route}".`);
        }
    }

    private async finish(): Promise<void> {
        const session = this.session();
        if (!session) return;

        if (session.id === 'app') {
            const database = await this.database.getDatabase();
            const settings = await database.settings.findOne('user_preferences').exec();
            if (!settings) {
                throw new Error('App settings are unavailable; tutorial completion could not be saved.');
            }
            await settings.incrementalPatch({ appTourCompleted: true });
        }

        this.session.set(null);
        if (this.router.url !== session.returnUrl) {
            const returned = await this.router.navigateByUrl(session.returnUrl);
            if (!returned) {
                throw new Error(`Could not return to "${session.returnUrl}" after the tutorial.`);
            }
        }
    }
}
