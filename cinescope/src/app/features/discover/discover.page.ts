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
    timeOutline,
    heart,
    heartOutline,
    arrowForwardOutline,
    videocamOutline,
    filmOutline,
    peopleOutline
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { HeroBannerComponent } from 'src/app/shared/components/hero-banner/hero-banner.component';
import { SwimlaneComponent } from 'src/app/shared/components/swimlane/swimlane.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { TrendingStore } from '../../core/store/trending.store';
import { FeedService } from '../../core/services/feed.service';
import { NavigationService } from '../../core/services/navigation.service';
import { AppTourService } from '../../core/services/app-tour.service';
import { PosterCacheService } from '../../core/services/poster-cache.service';
import { StorageService, extractPersonCreditMetadata } from '../../core/services/storage.service';
import { TmdbPeopleService } from '../../core/services/tmdb-people.service';
import { ToastService } from '../../core/services/toast.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';
import { TmdbPersonCombinedCreditsResponseDto } from '../../core/dtos/people/person-combined-credits.dto';
import {
    DiscoverPreferencesService,
    DiscoverLanguageCode,
    DISCOVER_LANGUAGE_OPTIONS
} from '../../core/services/discover-preferences.service';
import { CollectionQueryContext } from '../../core/services/collection-loader.service';

export type ActorsHubCategory = 'all' | 'favorites' | 'indian' | 'global' | 'world' | 'directors';

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
    public storage = inject(StorageService);
    private peopleService = inject(TmdbPeopleService);
    private toast = inject(ToastService);
    private posterCache = inject(PosterCacheService);
    private router = inject(Router);
    private navService = inject(NavigationService);
    private tour = inject(AppTourService);

    public actorsCategoryFilter = signal<ActorsHubCategory>('all');

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
        const combined = [
            ...this.discoverPrefs.indianLanguageOptions().slice(0, 14),
            ...this.discoverPrefs.globalLanguageOptions().slice(0, 18)
        ];
        // Ensure any custom selected language from the full 180+ TMDB catalog is also present
        for (const selOpt of this.discoverPrefs.selectedLanguageOptions()) {
            if (!combined.some((c) => c.code === selOpt.code)) {
                combined.unshift(selOpt);
            }
        }
        return combined.sort((a, b) => {
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
    public readonly indianActorsContext: CollectionQueryContext = { type: 'indian_people' };
    public readonly popularActorsContext: CollectionQueryContext = { type: 'popular_people' };
    public readonly worldActorsContext: CollectionQueryContext = { type: 'world_people' };
    public readonly visionaryDirectorsContext: CollectionQueryContext = { type: 'director_people' };
    public readonly breakoutActorsContext: CollectionQueryContext = { type: 'breakout_people' };

    public readonly favoriteActorsSwimlane = computed<SwimlaneItem[]>(() => {
        return this.storage.favoritePeople().map((doc) => {
            const p = (doc.payload ?? {}) as Record<string, unknown>;
            const rawPath = (p['profile_path'] || p['posterUrl']) as string | undefined;
            const knownFor = String(p['known_for_titles'] || p['known_for_department'] || 'Artist');
            return {
                id: doc.tmdbId,
                mediaType: 'person' as const,
                title: String(p['name'] || `Artist #${doc.tmdbId}`),
                subtitle: knownFor,
                posterUrl: resolveMediaImageUrl(rawPath, 'w500'),
                bookmarkState: 'none',
                payload: p
            };
        });
    });

    public readonly favoriteStarsMoviesContext = computed<CollectionQueryContext>(() => {
        const topFavIds = this.storage.favoritePeople().slice(0, 5).map((d) => d.tmdbId).filter(Boolean);
        return {
            type: 'discover_movies',
            movieParams: {
                with_people: topFavIds.join('|'),
                sort_by: 'vote_average.desc',
                'vote_count.gte': 30
            }
        };
    });

    public readonly spotlightCandidatePool = computed<SwimlaneItem[]>(() => {
        const cat = this.actorsCategoryFilter();
        const favs = this.favoriteActorsSwimlane();
        const indian = this.store.indianActors();
        const trending = this.store.trendingActors();
        const popular = this.store.popularActors();
        const world = this.store.worldActors();
        const directors = this.store.visionaryDirectors();

        let sourceList: SwimlaneItem[] = [];
        if (cat === 'favorites') {
            sourceList = favs;
        } else if (cat === 'indian') {
            sourceList = indian;
        } else if (cat === 'global') {
            sourceList = [...trending, ...popular];
        } else if (cat === 'world') {
            sourceList = world;
        } else if (cat === 'directors') {
            sourceList = directors;
        } else {
            sourceList = [
                ...favs,
                ...indian.slice(0, 8),
                ...trending.slice(0, 8),
                ...world.slice(0, 6),
                ...directors.slice(0, 6)
            ];
        }

        const deduped = new Map<number, SwimlaneItem>();
        for (const item of sourceList) {
            const numId = Number(item.id);
            if (numId > 0 && !deduped.has(numId)) {
                deduped.set(numId, item);
            }
        }
        return [...deduped.values()].slice(0, 20);
    });

    public readonly activeSpotlightStar = computed<SwimlaneItem | null>(() => {
        const pool = this.spotlightCandidatePool();
        const currentId = this.store.spotlightStarId();
        if (currentId) {
            const found = pool.find((p) => Number(p.id) === currentId);
            if (found) return found;
        }
        return pool[0] ?? null;
    });

    public readonly activeSpotlightProgress = computed<{ watched: number; total: number; percent: number } | null>(() => {
        const star = this.activeSpotlightStar();
        if (!star) return null;
        const favDoc = this.storage.favoritePeople().find((d) => d.tmdbId === Number(star.id));
        if (!favDoc) return null;
        const p = (favDoc.payload ?? {}) as Record<string, unknown>;
        const creditIds = Array.isArray(p['credit_ids']) ? (p['credit_ids'] as string[]) : [];
        if (creditIds.length === 0) return null;
        return this.storage.getPersonProgress(creditIds);
    });

    public readonly spotlightCriticsContext = computed<CollectionQueryContext>(() => {
        const star = this.activeSpotlightStar();
        return {
            type: 'discover_movies',
            movieParams: {
                with_people: String(star?.id || ''),
                sort_by: 'vote_average.desc',
                'vote_count.gte': 25
            }
        };
    });

    public readonly spotlightPopularContext = computed<CollectionQueryContext>(() => {
        const star = this.activeSpotlightStar();
        return {
            type: 'discover_movies',
            movieParams: {
                with_people: String(star?.id || ''),
                sort_by: 'popularity.desc'
            }
        };
    });

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
            timeOutline,
            heart,
            heartOutline,
            arrowForwardOutline,
            videocamOutline,
            filmOutline,
            peopleOutline
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

    public setActorsCategory(category: ActorsHubCategory): void {
        this.actorsCategoryFilter.set(category);
        const pool = this.spotlightCandidatePool();
        const currentId = this.store.spotlightStarId();
        if (pool.length > 0 && (!currentId || !pool.some((p) => Number(p.id) === currentId))) {
            void this.store.selectSpotlightStar(Number(pool[0].id));
        }
        // Reset horizontal scroll of avatar strip to start so the first star is never clipped
        const strip = document.querySelector('.spotlight-avatars-strip');
        if (strip) {
            strip.scrollTo({ left: 0, behavior: 'smooth' });
        }
    }

    public onSelectSpotlightStar(item: SwimlaneItem, event?: Event): void {
        const id = Number(item.id);
        if (id > 0 && id !== this.store.spotlightStarId()) {
            void this.store.selectSpotlightStar(id);
        }
        if (event?.currentTarget instanceof HTMLElement) {
            event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    public openSpotlightStarProfile(item: SwimlaneItem): void {
        void this.router.navigate(['/person', item.id], {
            state: {
                preview: {
                    id: Number(item.id),
                    name: item.title,
                    profileUrl: item.posterUrl,
                    knownForDepartment: item.subtitle
                }
            }
        });
    }

    public isSpotlightStarFavorite(item: SwimlaneItem): boolean {
        return this.storage.isPersonFavorite(Number(item.id));
    }

    public async toggleSpotlightStarFavorite(event: Event, item: SwimlaneItem): Promise<void> {
        event.stopPropagation();
        const personId = Number(item.id);
        if (!personId) return;
        const rawProfilePath = (item.payload?.['profile_path'] as string | null | undefined) ?? item.posterUrl ?? null;
        const rawDept = String(item.payload?.['known_for_department'] || 'Acting');
        const isNowFav = await this.storage.toggleFavoritePerson({
            id: personId,
            name: item.title,
            profilePath: rawProfilePath,
            department: rawDept,
            knownForTitles: item.subtitle || ''
        });

        if (isNowFav) {
            await this.toast.presentSuccess(`Added ${item.title} to Favorite Artists`, 1800);
            void this.store.refreshFavoriteStarMovies();
            try {
                const details = await firstValueFrom(this.peopleService.getPersonDetails(personId, 'combined_credits'));
                if (this.storage.isPersonFavorite(personId)) {
                    const combined = (details?.['combined_credits'] as TmdbPersonCombinedCreditsResponseDto | undefined) ?? null;
                    const extracted = extractPersonCreditMetadata(combined);
                    if (extracted.creditIds.length > 0) {
                        await this.storage.updateFavoritePersonCredits(personId, extracted.creditIds, {
                            topCredits: extracted.topCredits,
                            knownForTitles: extracted.knownForTitles,
                            department: details.known_for_department || undefined,
                            profilePath: details.profile_path
                        });
                    }
                }
            } catch {
                // Silent fallback if offline
            }
        } else {
            await this.toast.presentWarning(`Removed ${item.title} from Favorite Artists`, 1800);
            void this.store.refreshFavoriteStarMovies();
        }
    }

    public openArchivePeopleTab(): void {
        void this.router.navigate(['/tabs', 'archive'], { queryParams: { tab: 'people' } });
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
        void this.discoverPrefs.ensureApiCatalogsLoaded();
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
