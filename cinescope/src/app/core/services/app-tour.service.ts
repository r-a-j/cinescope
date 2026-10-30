import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Keyboard } from '@capacitor/keyboard';
import { APP_TOURS, AppTourId, AppTourStep } from '../constants/app-tour.constants';
import { DatabaseService } from '../database/database.service';
import { TrendingStore } from '../store/trending.store';
import { FranchiseAggregatorService } from './franchise-aggregator.service';

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
    private readonly franchiseAggregator = inject(FranchiseAggregatorService);

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

        const steps = this.resolveSteps(id);
        const returnUrl = this.router.url || '/tabs/discover';
        this.isNavigating.set(true);
        try {
            Keyboard.hide().catch(() => console.debug('[AppTour] Keyboard hide skipped'));
            await this.navigateTo(steps[0].route);
            this.stepIndex.set(0);
            this.session.set({ id, steps, returnUrl });
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

        const initialUrl = this.router.url || '/tabs/discover';
        await this.trendingStore.loadTrendingData();
        if (this.trendingStore.error() || this.router.url !== initialUrl) return;

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
            Keyboard.hide().catch(() => console.debug('[AppTour] Keyboard hide skipped'));
            await this.navigateTo(session.steps[index].route);
            this.stepIndex.set(index);
        } finally {
            this.isNavigating.set(false);
        }
    }

    private resolveSteps(id: AppTourId): AppTourStep[] {
        const steps = [...APP_TOURS[id].steps];
        if (id === 'franchise-merge') return this.resolveFranchiseMergeSteps(steps);
        if (id !== 'franchise') return steps;

        const franchise = this.franchiseAggregator.activeUserFranchises()[0];
        if (!franchise) return steps;

        const route = `/collection/${encodeURIComponent(String(franchise.id))}`;
        const archiveSteps = steps.filter(step => step.route.startsWith('/tabs/archive'));
        return [
            ...archiveSteps,
            {
                route,
                target: 'franchise-actions',
                title: 'Track a saga or build a universe',
                description: 'Track Saga keeps this collection on your shelf. AI Universe can find related sagas; review the proposal before adding a shared canon.'
            },
            {
                route,
                target: 'franchise-progress',
                title: 'Understand your progress',
                description: 'Progress counts released titles you have watched. Upcoming releases do not hold back completion, and Up Next points to the earliest released title you have not watched.'
            },
            {
                route,
                target: 'franchise-filters',
                title: 'Shape the timeline',
                description: 'Filter by watched status or movie/TV type, then cycle between chronological timeline, newest, rating, and A–Z sorting.'
            },
            {
                route,
                target: 'franchise-timeline',
                title: 'Update titles as you watch',
                description: 'Numbers show watch order and NEXT marks your next released title. Tap a poster’s bookmark to add it to your Watchlist or mark it watched.'
            }
        ];
    }

    private resolveFranchiseMergeSteps(fallbackSteps: AppTourStep[]): AppTourStep[] {
        const universe = this.franchiseAggregator.activeUserFranchises().find(franchise =>
            franchise.isUniverse
            && (
                (franchise.mergedSubCollectionIds?.some(id => this.isNavigableCollectionId(id)) ?? false)
                || (franchise.siblingFranchises?.some(sibling => this.isNavigableCollectionId(sibling.id)) ?? false)
            )
        );
        if (!universe) return fallbackSteps;

        const mergedId = universe.mergedSubCollectionIds?.find(id => this.isNavigableCollectionId(id));
        const sibling = universe.siblingFranchises?.find(candidate => this.isNavigableCollectionId(candidate.id));
        const collectionId = mergedId ?? sibling?.id;
        if (!collectionId) return fallbackSteps;

        const isMerged = Boolean(mergedId);
        const collectionRoute = `/collection/${collectionId}`;
        const universeRoute = `/collection/${encodeURIComponent(String(universe.universeId || universe.id))}`;

        return [
            {
                route: '/tabs/archive?tour=franchise-merge',
                target: 'archive-franchises-tab',
                title: 'Open your Franchises shelf',
                description: 'Archive is where you can see your tracked sagas and universes. Merging changes how these entries are grouped here.'
            },
            {
                route: collectionRoute,
                target: 'franchise-merge-toggle',
                title: isMerged ? 'Unmerge or keep this saga folded' : 'Merge this saga into its universe',
                description: isMerged
                    ? `This saga is folded into ${universe.name}. Tap “Merged in ${universe.name}” to unmerge it; it will return as a standalone Archive entry.`
                    : `Tap “Merge into ${universe.name}” to fold this saga under its universe in Archive. This does not add its titles to the universe canon.`
            },
            {
                route: universeRoute,
                target: 'franchise-progress',
                title: 'The universe page shows its canon',
                description: 'The timeline and progress count only titles in the universe canon. Folding or unfolding a saga organizes Archive entries; it does not change canon membership or progress.'
            },
            {
                route: '/tabs/archive?tour=franchise-merge',
                target: 'archive-franchise-' + (universe.universeId || universe.id),
                title: 'See the result in Archive',
                description: isMerged
                    ? `The ${universe.name} card contains this saga under its folded collections. Unmerging restores the saga as a separate card.`
                    : `After merging, the saga is listed inside the ${universe.name} card instead of as a top-level card. Unmerge it from the saga page to restore the separate card.`
            }
        ];
    }

    private isNavigableCollectionId(id: number): boolean {
        return id > 0 && (id < 90000 || id > 90100);
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

        if (this.router.url !== session.returnUrl) {
            this.isNavigating.set(true);
            try {
                Keyboard.hide().catch(() => console.debug('[AppTour] Keyboard hide skipped'));
                const returned = await this.router.navigateByUrl(session.returnUrl);
                if (!returned) {
                    throw new Error(`Could not return to "${session.returnUrl}" after the tutorial.`);
                }
            } finally {
                this.isNavigating.set(false);
            }
        }

        this.session.set(null);
    }
}
