import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';
import { Keyboard } from '@capacitor/keyboard';
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
    private modalActive = false;
    private previouslyFocusedElement: HTMLElement | null = null;
    private readonly backgroundStates: { element: HTMLElement; inert: boolean; ariaHidden: string | null }[] = [];
    private cardHeight = signal(0);
    private safeAreaTop = signal(0);
    private safeAreaBottom = signal(0);
    private resizeObserver: ResizeObserver | null = null;
    private readonly backButtonSubscription: Subscription;
    private readonly activeScrollElements = new Set<Element>();
    private trackingRafId: number | null = null;
    private readonly updatePosition = (): void => this.refreshSpotlight();
    private readonly handleKeydown = (event: KeyboardEvent): void => {
        if (!this.tour.isActive()) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            void this.runAction(() => this.tour.skip());
        } else if (event.key === 'Tab') {
            this.trapFocus(event);
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
        this.attachContentScrollListeners();
        this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(20, async (processNextHandler) => {
            if (this.tour.isActive()) {
                await this.runAction(() => this.tour.skip());
            } else {
                processNextHandler();
            }
        });

        effect(() => {
            const isActive = this.tour.isActive();
            if (isActive !== this.modalActive) {
                this.modalActive = isActive;
                if (isActive) {
                    this.enterModal();
                } else {
                    this.exitModal();
                }
            }

            const step = this.tour.currentStep();
            const isNavigating = this.tour.isNavigating();
            if (isActive && step && !isNavigating) {
                this.focusDialog();
            }
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
        this.stopTracking();
        this.cleanupScrollListeners();
        if (this.modalActive) {
            this.exitModal();
        }
    }

    public cardTop(): number {
        const viewHeight = this.document.defaultView?.innerHeight ?? 800;
        const rect = this.spotlight();
        const cardHeight = this.cardHeight() || 230;
        const headerOffset = this.currentTarget instanceof HTMLElement
            ? this.getHeaderOffset(this.currentTarget)
            : this.safeAreaTop() + 16;
        const minTop = Math.max(this.safeAreaTop() + 16, headerOffset);
        const tabBar = Array.from(this.document.querySelectorAll('ion-tab-bar'))
            .find(candidate => this.isVisible(candidate));
        const tabBarTop = tabBar?.getBoundingClientRect().top ?? viewHeight;
        const availableBottom = Math.min(viewHeight - this.safeAreaBottom(), tabBarTop);
        const maxTop = Math.max(minTop, availableBottom - cardHeight - 16);
        if (!rect) return Math.max(minTop, (viewHeight - cardHeight) / 2);

        // Check if there is enough space ABOVE the spotlight without overlapping
        const spaceAbove = rect.top - minTop;
        const spaceBelow = availableBottom - rect.bottom;
        const clearance = 16;

        const fitsAbove = spaceAbove >= cardHeight + clearance;
        const fitsBelow = spaceBelow >= cardHeight + clearance;

        if (fitsAbove && (!fitsBelow || spaceAbove >= spaceBelow)) {
            // Place safely above the spotlight
            return Math.min(maxTop, Math.max(minTop, rect.top - cardHeight - clearance));
        }

        if (fitsBelow) {
            // Place safely below the spotlight
            return Math.min(maxTop, Math.max(minTop, rect.bottom + clearance));
        }

        // Neither side has full clearance; place in whichever side has more room
        if (spaceAbove >= spaceBelow) {
            return Math.max(minTop, rect.top - cardHeight - clearance);
        }

        return Math.min(maxTop, rect.bottom + clearance);
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

    private enterModal(): void {
        Keyboard.hide().catch(() => console.debug('[AppTour] Keyboard hide skipped'));
        this.attachContentScrollListeners();
        const activeElement = this.document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
        this.previouslyFocusedElement = activeElement instanceof HTMLElement && activeElement !== this.document.body
            ? activeElement
            : null;

        for (const element of this.document.querySelectorAll<HTMLElement>('ion-router-outlet')) {
            this.backgroundStates.push({
                element,
                inert: element.inert,
                ariaHidden: element.getAttribute('aria-hidden')
            });
            element.inert = true;
            element.setAttribute('aria-hidden', 'true');
        }
    }

    private exitModal(): void {
        this.stopTracking();
        this.cleanupScrollListeners();
        for (const state of this.backgroundStates.splice(0)) {
            state.element.inert = state.inert;
            if (state.ariaHidden === null) {
                state.element.removeAttribute('aria-hidden');
            } else {
                state.element.setAttribute('aria-hidden', state.ariaHidden);
            }
        }

        const element = this.previouslyFocusedElement;
        this.previouslyFocusedElement = null;
        this.document.defaultView?.requestAnimationFrame(() => {
            if (element?.isConnected && this.isVisible(element)) {
                element.focus({ preventScroll: true });
            }
        });
    }

    private focusDialog(): void {
        Keyboard.hide().catch(() => console.debug('[AppTour] Keyboard hide skipped'));
        this.document.defaultView?.requestAnimationFrame(() => {
            if (!this.tour.isActive() || this.tour.isNavigating()) return;
            const activeElement = this.document.activeElement;
            if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
                activeElement.blur();
            }
            this.document.querySelector<HTMLElement>('[role="dialog"].tour-card')
                ?.focus({ preventScroll: true });
        });
    }

    private trapFocus(event: KeyboardEvent): void {
        const dialog = this.document.querySelector<HTMLElement>('[role="dialog"].tour-card');
        if (!dialog) return;

        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(element => element.tabIndex >= 0 && this.isVisible(element));
        if (focusable.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeElement = this.document.activeElement;
        if (!dialog.contains(activeElement)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && (activeElement === first || activeElement === dialog)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (activeElement === last || activeElement === dialog)) {
            event.preventDefault();
            first.focus();
        }
    }

    private findTarget(targetId: string): void {
        const lookup = ++this.targetLookup;
        const deadline = Date.now() + 8000;
        this.attachContentScrollListeners();

        const find = (): void => {
            if (lookup !== this.targetLookup) return;

            const targets = this.document.querySelectorAll(`[data-tour="${targetId}"]`);
            const target = Array.from(targets).find(candidate => this.isVisible(candidate));
            if (target) {
                this.currentTarget = target;
                if (target instanceof HTMLElement) {
                    this.scrollToTarget(target);
                } else {
                    this.refreshSpotlight();
                }
                return;
            }

            if (Date.now() < deadline) {
                this.document.defaultView?.requestAnimationFrame(find);
                return;
            }

            console.error(`[AppTour] Could not find tutorial target "${targetId}".`);
            this.spotlight.set(null);
        };

        this.document.defaultView?.requestAnimationFrame(find);
    }

    private scrollToTarget(target: HTMLElement): void {
        const viewHeight = this.document.defaultView?.innerHeight ?? 800;
        const headerOffset = this.getHeaderOffset(target);
        const cardH = this.cardHeight() || 230;
        const rect = target.getBoundingClientRect();

        const tabBar = Array.from(this.document.querySelectorAll('ion-tab-bar'))
            .find(candidate => this.isVisible(candidate));
        const tabBarTop = tabBar?.getBoundingClientRect().top ?? (viewHeight - this.safeAreaBottom());
        const availableBottom = Math.min(viewHeight - this.safeAreaBottom(), tabBarTop);

        const isComfortablyVisible = rect.top >= headerOffset + 8 && rect.bottom <= availableBottom - 16;
        const spaceAbove = rect.top - headerOffset;
        const spaceBelow = availableBottom - rect.bottom;
        const hasClearance = (spaceAbove >= cardH + 16) || (spaceBelow >= cardH + 16);

        if (isComfortablyVisible && hasClearance) {
            this.refreshSpotlight();
            this.startContinuousTracking(300);
            return;
        }

        const desiredTop = headerOffset + 12;
        const delta = rect.top - desiredTop;

        const ionContent = target.closest<HTMLElement>('ion-content');
        const contentWithScroll = ionContent as unknown as { getScrollElement?: () => Promise<HTMLElement> };
        if (ionContent && typeof contentWithScroll.getScrollElement === 'function') {
            void contentWithScroll.getScrollElement().then((scrollEl) => {
                if (scrollEl) {
                    const nextScrollTop = Math.max(0, scrollEl.scrollTop + delta);
                    scrollEl.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
                    this.startContinuousTracking(600);
                } else {
                    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    this.startContinuousTracking(600);
                }
            });
            return;
        }

        let scrollParent: HTMLElement | null = target.parentElement;
        while (scrollParent && scrollParent !== this.document.body) {
            const style = this.document.defaultView?.getComputedStyle(scrollParent);
            if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
                const nextScrollTop = Math.max(0, scrollParent.scrollTop + delta);
                scrollParent.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
                this.startContinuousTracking(600);
                return;
            }
            scrollParent = scrollParent.parentElement;
        }

        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        this.startContinuousTracking(600);
    }

    private getHeaderOffset(target: HTMLElement): number {
        const page = target.closest('.ion-page') || target.closest('ion-content') || this.document;
        const header = page.querySelector('.collection-topbar, ion-header, header, [class*="topbar"]');
        let headerHeight = 0;
        if (header instanceof HTMLElement && this.isVisible(header)) {
            headerHeight = header.getBoundingClientRect().height;
        }
        return Math.max(headerHeight, this.safeAreaTop()) + 8;
    }

    private startContinuousTracking(durationMs = 600): void {
        this.stopTracking();

        const endTime = Date.now() + durationMs;
        const track = (): void => {
            if (!this.tour.isActive() || !this.currentTarget) {
                this.trackingRafId = null;
                return;
            }
            this.refreshSpotlight();
            if (Date.now() < endTime) {
                this.trackingRafId = this.document.defaultView?.requestAnimationFrame(track) ?? null;
            } else {
                this.trackingRafId = null;
            }
        };

        this.trackingRafId = this.document.defaultView?.requestAnimationFrame(track) ?? null;
    }

    private stopTracking(): void {
        if (this.trackingRafId !== null && this.document.defaultView) {
            this.document.defaultView.cancelAnimationFrame(this.trackingRafId);
            this.trackingRafId = null;
        }
    }

    private attachContentScrollListeners(): void {
        const contents = Array.from(this.document.querySelectorAll<HTMLElement>('ion-content'));
        for (const content of contents) {
            const ionContent = content as unknown as { getScrollElement?: () => Promise<HTMLElement> };
            if (typeof ionContent.getScrollElement === 'function') {
                void ionContent.getScrollElement().then((scrollEl) => {
                    if (scrollEl && !this.activeScrollElements.has(scrollEl)) {
                        this.activeScrollElements.add(scrollEl);
                        scrollEl.addEventListener('scroll', this.updatePosition, { passive: true });
                    }
                });
            }
        }
    }

    private cleanupScrollListeners(): void {
        for (const el of this.activeScrollElements) {
            el.removeEventListener('scroll', this.updatePosition);
        }
        this.activeScrollElements.clear();
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
