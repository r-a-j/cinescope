import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, AfterViewInit, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
    IonContent,
    IonToolbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSkeletonText,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonRefresher,
    IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    refreshOutline,
    swapVerticalOutline,
    openOutline,
    optionsOutline,
    sparklesOutline,
    checkmark,
    languageOutline,
    eyeOffOutline,
    eyeOutline,
    newspaperOutline,
    timeOutline
} from 'ionicons/icons';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { HeroBannerComponent } from 'src/app/shared/components/hero-banner/hero-banner.component';
import { SwimlaneComponent } from 'src/app/shared/components/swimlane/swimlane.component';
import { TrendingStore } from '../../core/store/trending.store';
import { FeedService } from '../../core/services/feed.service';
import { NavigationService } from '../../core/services/navigation.service';
import { AppTourService } from '../../core/services/app-tour.service';
import { PosterCacheService } from '../../core/services/poster-cache.service';
import {
    DiscoverPreferencesService,
    DiscoverLanguageCode,
    DISCOVER_LANGUAGE_OPTIONS
} from '../../core/services/discover-preferences.service';
import { CollectionQueryContext } from '../../core/services/collection-loader.service';

@Component({
    selector: 'app-discover',
    standalone: true,
    imports: [
        CommonModule,
        IonContent,
        IonToolbar,
        IonSegment,
        IonSegmentButton,
        IonLabel,
        IonSkeletonText,
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardContent,
        IonButton,
        IonIcon,
        IonRefresher,
        IonRefresherContent,
        HeaderComponent,
        HeroBannerComponent,
        SwimlaneComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './discover.page.html',
    styleUrls: ['./discover.page.scss'],
})
export class DiscoverPage implements OnInit, AfterViewInit {
    public store = inject(TrendingStore);
    public feedService = inject(FeedService);
    public discoverPrefs = inject(DiscoverPreferencesService);
    private posterCache = inject(PosterCacheService);
    private router = inject(Router);
    private navService = inject(NavigationService);
    private tour = inject(AppTourService);

    private loadedNewsImages = signal<Set<string>>(new Set());
    private failedNewsImages = signal<Set<string>>(new Set());

    @ViewChild(IonContent, { static: false }) private content?: IonContent;
    private scrollEl: HTMLElement | null = null;
    private scrollPositions: Record<string, number> = {
        'for-you': 0,
        'trending': 0,
        'desi-hub': 0,
        'bollywood': 0,
        'ott-streaming': 0,
        'top-rated': 0,
        'actors': 0,
        'news': 0
    };

    public readonly discoverTabs = this.discoverPrefs.visibleTabs;
    public readonly allLanguageOptions = DISCOVER_LANGUAGE_OPTIONS;

    public readonly sortedQuickLanguageChips = computed(() => {
        const selected = new Set(this.discoverPrefs.preferredLanguages());
        return [...DISCOVER_LANGUAGE_OPTIONS].sort((a, b) => {
            const aSel = selected.has(a.code) ? 0 : 1;
            const bSel = selected.has(b.code) ? 0 : 1;
            return aSel - bSel;
        });
    });

    // Default to 'trending'
    public activeSection = signal<string>('trending');

    // Structured Query Contexts for Static Discover Lanes
    public readonly viralMoviesContext: CollectionQueryContext = { type: 'trending_movies' };
    public readonly nowPlayingContext: CollectionQueryContext = { type: 'now_playing' };
    public readonly bingeTvContext: CollectionQueryContext = { type: 'trending_tv' };
    public readonly airingTvContext: CollectionQueryContext = { type: 'on_the_air' };
    public readonly modernMasterpiecesContext: CollectionQueryContext = {
        type: 'discover_movies',
        movieParams: {
            'primary_release_date.gte': '2020-01-01',
            sort_by: 'vote_average.desc',
            'vote_count.gte': 1000
        }
    };
    public readonly hallOfFameMoviesContext: CollectionQueryContext = { type: 'top_rated_movies' };
    public readonly prestigeTvContext: CollectionQueryContext = { type: 'top_rated_tv' };
    public readonly topRatedIndianContext: CollectionQueryContext = {
        type: 'discover_movies',
        movieParams: {
            with_origin_country: 'IN',
            sort_by: 'vote_average.desc',
            'vote_count.gte': 60
        }
    };
    public readonly trendingActorsContext: CollectionQueryContext = { type: 'trending_people' };
    public readonly popularActorsContext: CollectionQueryContext = { type: 'popular_people' };
    public readonly breakoutActorsContext: CollectionQueryContext = { type: 'breakout_people' };

    constructor() {
        addIcons({
            refreshOutline,
            swapVerticalOutline,
            openOutline,
            optionsOutline,
            sparklesOutline,
            checkmark,
            languageOutline,
            eyeOffOutline,
            eyeOutline,
            newspaperOutline,
            timeOutline
        });

        effect(() => {
            const newsUrls = this.feedService
                .displayedItems()
                .map((item) => item.image)
                .filter((url): url is string => !!url);
            if (newsUrls.length > 0) {
                this.posterCache.prewarmUrls(newsUrls.slice(0, 8));
            }
        });

        effect(() => {
            const visible = this.discoverTabs();
            const current = this.activeSection();
            if (visible.length > 0 && !visible.some((t) => t.value === current)) {
                const fallback = visible[0].value;
                this.activeSection.set(fallback);
                this.triggerSectionLoad(fallback);
            }
        });

        effect(() => {
            const trigger = this.navService.resetDiscoverTrigger();
            if (trigger > 0) {
                const hasTrending = this.discoverTabs().some((t) => t.value === 'trending');
                const defaultTab = hasTrending ? 'trending' : (this.discoverTabs()[0]?.value || 'trending');
                this.scrollPositions[defaultTab] = 0;
                this.activeSection.set(defaultTab);
                if (this.scrollEl) {
                    this.scrollEl.scrollTop = 0;
                }
                void this.content?.scrollToTop(300);

                const btn = document.querySelector(`ion-segment-button[value="${defaultTab}"]`);
                btn?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        });
    }

    public openDiscoverPreferences(): void {
        void this.router.navigate(['/settings'], { queryParams: { section: 'discover' } });
    }

    public async onQuickToggleLanguage(code: DiscoverLanguageCode): Promise<void> {
        await this.discoverPrefs.toggleLanguage(code);
        await this.store.loadDesiHubData(true);
    }

    public async onQuickToggleHideWatched(): Promise<void> {
        this.discoverPrefs.toggleHideWatched();
        const section = this.activeSection();
        if (section === 'for-you') {
            await this.store.loadForYouData(true);
        } else if (section === 'trending') {
            await this.store.loadTrendingData(true);
        } else if (section === 'desi-hub') {
            await this.store.loadDesiHubData(true);
        } else if (section === 'bollywood') {
            await this.store.loadBollywoodData(true);
        } else if (section === 'ott-streaming') {
            await this.store.loadOttStreamingData(true);
        }
    }

    public isNewsImageLoaded(url: string | undefined): boolean {
        if (!url) return false;
        return this.posterCache.isWarm(url) || this.loadedNewsImages().has(url);
    }

    public isNewsImageFailed(url: string | undefined): boolean {
        if (!url) return true;
        return this.failedNewsImages().has(url);
    }

    public onNewsImageLoad(event: Event, url: string | undefined): void {
        if (!url) return;
        const img = event.target as HTMLImageElement | null;
        this.posterCache.markLoaded(url, img ?? undefined);
        this.loadedNewsImages.update((prev) => {
            const next = new Set(prev);
            next.add(url);
            return next;
        });
    }

    public onNewsImageError(url: string | undefined): void {
        if (!url) return;
        this.failedNewsImages.update((prev) => {
            const next = new Set(prev);
            next.add(url);
            return next;
        });
    }

    ngOnInit(): void {
        this.store.loadTrendingData();
    }

    public ionViewWillEnter(): void {
        const section = this.activeSection();
        if (section === 'desi-hub') {
            void this.store.loadDesiHubData();
        } else if (section === 'for-you') {
            void this.store.loadForYouData(true);
        }
    }

    public async ngAfterViewInit(): Promise<void> {
        this.scrollEl = (await this.content?.getScrollElement()) ?? null;
    }

    private triggerSectionLoad(section: string): void {
        if (section === 'for-you') {
            void this.store.loadForYouData();
        } else if (section === 'trending') {
            void this.store.loadTrendingData();
        } else if (section === 'desi-hub') {
            void this.store.loadDesiHubData();
        } else if (section === 'bollywood') {
            void this.store.loadBollywoodData();
        } else if (section === 'ott-streaming') {
            void this.store.loadOttStreamingData();
        } else if (section === 'top-rated') {
            void this.store.loadTopRatedData();
        } else if (section === 'actors') {
            void this.store.loadActorsData();
        } else if (section === 'news' && this.feedService.feedItems().length === 0) {
            void this.feedService.refreshFeed();
        }
    }

    public async onPullRefresh(event: CustomEvent): Promise<void> {
        const target = event.target as HTMLIonRefresherElement | null;
        try {
            const section = this.activeSection();
            if (section === 'for-you') {
                await this.store.loadForYouData(true);
            } else if (section === 'trending') {
                await this.store.loadTrendingData(true);
            } else if (section === 'desi-hub') {
                await this.store.loadDesiHubData(true);
            } else if (section === 'bollywood') {
                await this.store.loadBollywoodData(true);
            } else if (section === 'ott-streaming') {
                await this.store.loadOttStreamingData(true);
            } else if (section === 'top-rated') {
                await this.store.loadTopRatedData(true);
            } else if (section === 'actors') {
                await this.store.loadActorsData(true);
            } else if (section === 'news') {
                await this.feedService.refreshFeed();
            }
        } finally {
            if (target) {
                await target.complete();
            }
        }
    }

    public async retryTrending(): Promise<void> {
        await this.store.loadTrendingData(true);
        if (!this.store.error()) {
            try {
                await this.tour.startFirstRun();
            } catch (error) {
                console.error('[Discover] Could not start the first-run tutorial after retry:', error);
            }
        }
    }

    public setNewsSource(source: string): void {
        this.feedService.activeFilter.set(source);
    }

    public toggleNewsSort(): void {
        const next = this.feedService.sortDirection() === 'newest' ? 'oldest' : 'newest';
        this.feedService.sortDirection.set(next);
    }

    public async onSectionChange(event: Event): Promise<void> {
        const customEvent = event as CustomEvent;
        const newSection = customEvent.detail?.value as string | undefined;

        if (newSection && newSection !== this.activeSection()) {
            const prevSection = this.activeSection();
            if (!this.scrollEl && this.content) {
                this.scrollEl = (await this.content.getScrollElement()) ?? null;
            }
            if (this.scrollEl) {
                this.scrollPositions[prevSection] = this.scrollEl.scrollTop;
            }

            this.activeSection.set(newSection);
            this.triggerSectionLoad(newSection);

            const targetY = this.scrollPositions[newSection] || 0;
            if (targetY === 0 && this.scrollEl) {
                this.scrollEl.scrollTop = 0;
            }
            requestAnimationFrame(() => {
                if (this.scrollEl) {
                    this.scrollEl.scrollTop = targetY;
                } else {
                    void this.content?.scrollToPoint(0, targetY, 0);
                }
            });

            // Smoothly auto-center the clicked button
            const segmentEl = customEvent.target as HTMLElement;
            const activeBtn = segmentEl?.querySelector(`ion-segment-button[value="${newSection}"]`);

            if (activeBtn) {
                activeBtn.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }
}
