import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';
import { filter, Subscription, take } from 'rxjs';
import { AppTourService } from '../../../core/services/app-tour.service';

interface SpotlightRect {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

@Component({
    selector: 'app-tour-overlay',
    standalone: true,
    templateUrl: './app-tour-overlay.component.html',
    styleUrls: ['./app-tour-overlay.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppTourOverlayComponent implements OnDestroy {
    public readonly tour = inject(AppTourService);
    private readonly document = inject(DOCUMENT);
    private readonly router = inject(Router);
    private readonly platform = inject(Platform);
    public readonly spotlight = signal<SpotlightRect | null>(null);
    public readonly errorMessage = signal('');

    private currentTarget: Element | null = null;
    private targetLookup = 0;
    private cardHeight = signal(0);
    private safeAreaTop = signal(0);
    private safeAreaBottom = signal(0);
    private resizeObserver: ResizeObserver | null = null;
    private readonly backButtonSubscription: Subscription;
    private readonly updatePosition = (): void => this.refreshSpotlight();
    private readonly handleKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && this.tour.isActive()) {
            event.preventDefault();
            void this.runAction(() => this.tour.skip());
        }
    };

    @ViewChild('tourCard')
    public set tourCard(ref: ElementRef<HTMLElement> | undefined) {
        this.resizeObserver?.disconnect();
        if (!ref) return;

        const element = ref.nativeElement;
        const updateCardMetrics = (): void => {
            this.cardHeight.set(element.getBoundingClientRect().height);
            const styles = this.document.defaultView?.getComputedStyle(element);
            this.safeAreaTop.set(Number.parseFloat(styles?.getPropertyValue('--tour-safe-area-top') ?? '') || 0);
            this.safeAreaBottom.set(Number.parseFloat(styles?.getPropertyValue('--tour-safe-area-bottom') ?? '') || 0);
        };
        updateCardMetrics();
        this.resizeObserver = new ResizeObserver(updateCardMetrics);
        this.resizeObserver.observe(element);
    }

    constructor() {
        this.document.addEventListener('scroll', this.updatePosition, true);
        this.document.addEventListener('keydown', this.handleKeydown);
        this.document.defaultView?.addEventListener('resize', this.updatePosition);
        this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(20, async (processNextHandler) => {
            if (this.tour.isActive()) {
                await this.runAction(() => this.tour.skip());
            } else {
                processNextHandler();
            }
        });

        effect(() => {
            const step = this.tour.currentStep();
            const isNavigating = this.tour.isNavigating();
            if (!step || isNavigating) {
                this.targetLookup++;
                this.currentTarget = null;
                this.spotlight.set(null);
                return;
            }

            this.errorMessage.set('');
            this.findTarget(step.target);
        });

        if (this.router.navigated) {
            this.startFirstRun();
        } else {
            this.router.events.pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                take(1)
            ).subscribe(() => this.startFirstRun());
        }
    }

    public ngOnDestroy(): void {
        this.document.removeEventListener('scroll', this.updatePosition, true);
        this.document.removeEventListener('keydown', this.handleKeydown);
        this.document.defaultView?.removeEventListener('resize', this.updatePosition);
        this.resizeObserver?.disconnect();
        this.backButtonSubscription.unsubscribe();
    }

    public cardTop(): number {
        const viewHeight = this.document.defaultView?.innerHeight ?? 800;
        const rect = this.spotlight();
        const cardHeight = this.cardHeight() || 230;
        const minTop = this.safeAreaTop() + 16;
        const tabBar = Array.from(this.document.querySelectorAll('ion-tab-bar'))
            .find(candidate => this.isVisible(candidate));
        const tabBarTop = tabBar?.getBoundingClientRect().top ?? viewHeight;
        const availableBottom = Math.min(viewHeight - this.safeAreaBottom(), tabBarTop);
        const maxTop = Math.max(minTop, availableBottom - cardHeight - 16);
        if (!rect) return Math.max(minTop, (viewHeight - cardHeight) / 2);

        const preferred = rect.top > viewHeight * 0.55
            ? rect.top - cardHeight - 16
            : rect.bottom + 16;
        return Math.min(Math.max(preferred, minTop), maxTop);
    }

    public async next(): Promise<void> {
        await this.runAction(() => this.tour.next());
    }

    public async previous(): Promise<void> {
        await this.runAction(() => this.tour.previous());
    }

    public async skip(): Promise<void> {
        await this.runAction(() => this.tour.skip());
    }

    private async runAction(action: () => Promise<void>): Promise<void> {
        this.errorMessage.set('');
        try {
            await action();
        } catch (error) {
            console.error('[AppTour] Tutorial action failed:', error);
            this.errorMessage.set('The tutorial could not continue. Please try again or close it.');
        }
    }

    private startFirstRun(): void {
        void this.tour.startFirstRun().catch(error => {
            console.error('[AppTour] Could not start the first-run tutorial:', error);
        });
    }

    private findTarget(targetId: string): void {
        const lookup = ++this.targetLookup;
        let attempts = 0;

        const find = (): void => {
            if (lookup !== this.targetLookup) return;

            const targets = this.document.querySelectorAll(`[data-tour="${targetId}"]`);
            const target = Array.from(targets).find(candidate => this.isVisible(candidate));
            if (target) {
                this.currentTarget = target;
                if (target instanceof HTMLElement) {
                    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
                }
                this.refreshSpotlight();
                return;
            }

            attempts++;
            if (attempts < 60) {
                this.document.defaultView?.requestAnimationFrame(find);
                return;
            }

            console.error(`[AppTour] Could not find tutorial target "${targetId}".`);
            this.spotlight.set(null);
        };

        this.document.defaultView?.requestAnimationFrame(find);
    }

    private isVisible(target: Element): boolean {
        const rect = target.getBoundingClientRect();
        const style = this.document.defaultView?.getComputedStyle(target);
        return rect.width > 0
            && rect.height > 0
            && style?.display !== 'none'
            && style?.visibility !== 'hidden'
            && !target.closest('.ion-page-hidden');
    }

    private refreshSpotlight(): void {
        if (!this.tour.isActive() || this.tour.isNavigating() || !this.currentTarget) return;

        const rect = this.currentTarget.getBoundingClientRect();
        const padding = 8;
        const view = this.document.defaultView;
        const width = view?.innerWidth ?? 0;
        const height = view?.innerHeight ?? 0;
        const left = Math.max(8, rect.left - padding);
        const top = Math.max(8, rect.top - padding);
        const right = Math.min(width - 8, rect.right + padding);
        const bottom = Math.min(height - 8, rect.bottom + padding);

        this.spotlight.set({
            top,
            left,
            right,
            bottom,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top)
        });
    }
}
