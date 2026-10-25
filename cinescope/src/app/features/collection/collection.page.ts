import {
  Component, ChangeDetectionStrategy, OnInit, AfterViewInit, inject,
  signal, computed, effect, ViewChild, ChangeDetectorRef, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner, NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, homeOutline, star, albumsOutline, filmOutline,
  tvOutline, checkmarkCircle, checkmarkDoneOutline, checkmarkSharp, addCircleOutline, playForwardOutline, bookmarkOutline, bookmark, sparkles, sparklesOutline, timeOutline, swapVerticalOutline, syncOutline, gitMergeOutline, gitBranchOutline
} from 'ionicons/icons';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { StorageService, getLocalTodayIso } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { NavigationService } from '../../core/services/navigation.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';
import { FranchiseAggregatorService, isPartReleased } from '../../core/services/franchise-aggregator.service';
import { FranchiseIntelService } from '../../core/services/franchise-intel.service';
import { FranchiseCollectionSummary, FranchiseIntelResponse, FranchisePart } from '../../core/models/franchise.model';
import { UniverseProposalModalComponent } from './components/universe-proposal-modal/universe-proposal-modal.component';
import {
  CollectionLoaderService,
  CollectionQueryContext,
  CollectionSortMode,
  CollectionFilterOptions,
  GENRE_MAP
} from '../../core/services/collection-loader.service';

interface CollectionCardVm {
  item: SwimlaneItem;
  metaLine: string;
  ratingValue: number;
  yearValue: string;
  isUpcoming: boolean;
  chronologicalOrder?: number | undefined;
  isUpNext?: boolean | undefined;
  isWatched?: boolean | undefined;
}

@Component({
  selector: 'app-collection-page',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    PosterCardComponent,
    UniverseProposalModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection.page.html',
  styleUrls: ['./collection.page.scss'],
})
export class CollectionPage implements OnInit, AfterViewInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private navService = inject(NavigationService);
  private collectionLoader = inject(CollectionLoaderService);
  private franchiseAggregator = inject(FranchiseAggregatorService);
  public franchiseIntel = inject(FranchiseIntelService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @ViewChild(IonContent, { static: false }) private content?: IonContent;
  @ViewChild(IonInfiniteScroll, { static: false }) private infiniteScroll?: IonInfiniteScroll;

  public collectionTitle = signal<string>('Collection');
  public collectionBackdrop = signal<string | null>(null);
  public collectionOverview = signal<string | null>(null);
  public isFranchiseCollection = signal<boolean>(false);
  public isUniverseCollection = signal<boolean>(false);
  public franchiseSummary = signal<FranchiseCollectionSummary | null>(null);
  public numericCollectionId = signal<number | null>(null);

  // AI Universe Reasoning States
  public isAnalyzingUniverse = signal<boolean>(false);
  public isResolvingCanon = signal<boolean>(false);
  public isSyncingUniverse = signal<boolean>(false);
  public universeProposal = signal<FranchiseIntelResponse | null>(null);
  public showUniverseModal = signal<boolean>(false);

  public rawItems = signal<SwimlaneItem[]>([]);
  public sortMode = signal<CollectionSortMode>('featured');

  // Dual-Axis Filters for Franchises/Universes
  public mediaTypeFilter = signal<'all' | 'movie' | 'tv'>('all');
  public libraryFilter = signal<'all' | 'watched' | 'watchlist' | 'unwatched'>('all');

  public filters = signal<CollectionFilterOptions>({
    minRating: null,
    recentOnly: false,
    highVotesOnly: false,
    genres: []
  });
  public queryContext = signal<CollectionQueryContext | undefined>(undefined);
  public currentPage = signal<number>(1);
  public hasMore = signal<boolean>(true);
  public isLoadingMore = signal<boolean>(false);

  private isFetchingMore = false;
  private scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  public hasActiveFilters = computed<boolean>(() => {
    if (this.isFranchiseCollection()) {
      return this.mediaTypeFilter() !== 'all' || this.libraryFilter() !== 'all';
    }
    const f = this.filters();
    return f.minRating !== null || f.recentOnly || f.highVotesOnly || f.genres.length > 0;
  });

  public isPersonCollection = computed<boolean>(() => {
    const list = this.rawItems();
    return list.length > 0 && list[0].mediaType === 'person';
  });

  public isCurrentFranchiseSaved = computed<boolean>(() => {
    if (this.isUniverseCollection()) {
      const uniId = this.franchiseSummary()?.universeId || this.franchiseSummary()?.id;
      if (uniId) {
        return this.franchiseAggregator.isFranchiseTracked(uniId);
      }
    }
    const numId = this.numericCollectionId();
    if (numId) {
      return this.franchiseAggregator.isFranchiseTracked(numId);
    }
    const queryCtx = this.queryContext();
    if (queryCtx?.id) {
      return this.franchiseAggregator.isFranchiseTracked(queryCtx.id);
    }
    return false;
  });

  /**
   * Detects if the current numeric collection is already subsumed under an Ascended Universe in RxDB,
   * allowing the user to jump straight to their Universe without re-running AI!
   */
  public existingParentUniverse = computed<FranchiseCollectionSummary | null>(() => {
    if (this.isUniverseCollection()) return null;
    const colId = this.numericCollectionId();
    if (!colId) return null;

    const allActive = this.franchiseAggregator.activeUserFranchises();
    const items = this.rawItems();
    const firstMovieId = items[0]?.id;

    for (const f of allActive) {
      if (!f.isUniverse) continue;
      if (f.siblingFranchises?.some((s) => s.id === colId)) {
        return f;
      }
      if (firstMovieId && f.parts?.some((p) => Number(p.id) === Number(firstMovieId) && (p.mediaType || 'movie') === 'movie')) {
        return f;
      }
    }
    return null;
  });

  public isMergedIntoParentUniverse = computed<boolean>(() => {
    const colId = this.numericCollectionId();
    const parentUni = this.existingParentUniverse();
    if (!colId || !parentUni) return false;
    return this.storageService.isCollectionMergedIntoUniverse(parentUni.id, colId);
  });

  public currentUniverseJob = computed(() => {
    const job = this.franchiseIntel.activeJob();
    if (!job || !this.isUniverseCollection()) return null;
    const currentSummary = this.franchiseSummary();
    const currentKey = String(currentSummary?.universeId || currentSummary?.id || '').replace(/^(universe_)+/, '');
    const jobKey = String(job.universeId).replace(/^(universe_)+/, '');
    return currentKey === jobKey ? job : null;
  });

  public async toggleMergeWithParentUniverse(): Promise<void> {
    const colId = this.numericCollectionId();
    const parentUni = this.existingParentUniverse();
    if (!colId || !parentUni) return;

    if (this.isMergedIntoParentUniverse()) {
      await this.storageService.unmergeCollectionFromUniverse(parentUni.id, colId);
      await this.toastService.presentInfo(`Showing "${this.collectionTitle()}" as standalone saga in Archive`, 2000);
    } else {
      await this.storageService.mergeCollectionIntoUniverse(parentUni.id, colId);
      await this.toastService.presentSuccess(`Folded "${this.collectionTitle()}" into "${parentUni.name}"`, 2000);
    }
  }

  public completionMetrics = computed(() => {
    if (!this.isFranchiseCollection()) return null;
    const items = this.rawItems();
    if (items.length === 0) {
      return {
        watched: 0,
        watchlist: 0,
        total: 0,
        upcomingCount: 0,
        percentage: 0,
        upNextItem: null as SwimlaneItem | null,
        upNextYear: ''
      };
    }

    const watchedKeys = this.storageService.watchedMediaKeys();
    const watchlistDocs = this.storageService.watchlistItems();
    const watchlistKeys = new Set(watchlistDocs.map((d) => d.id));
    const todayIso = getLocalTodayIso();

    // Sort items chronologically to identify accurate released count & "Up Next"
    const sorted = [...items].sort((a, b) => {
      const dA = String(a.payload?.['release_date'] || a.payload?.['first_air_date'] || '').trim();
      const dB = String(b.payload?.['release_date'] || b.payload?.['first_air_date'] || '').trim();
      if (!dA && !dB) return 0;
      if (!dA) return 1;
      if (!dB) return -1;
      return dA.localeCompare(dB);
    });

    const hasAnyDated = sorted.some((it) =>
      Boolean(String(it.payload?.['release_date'] || it.payload?.['first_air_date'] || '').trim())
    );

    let watched = 0;
    let watchlist = 0;
    let releasedCount = 0;
    let upcomingCount = 0;
    let upNextItem: SwimlaneItem | null = null;
    let upNextYear = '';

    for (const it of sorted) {
      const key = `${it.mediaType || 'movie'}_${it.id}`;
      const isWatched = watchedKeys.has(key);
      const isWatchlist = watchlistKeys.has(key);
      const rawDate = String(it.payload?.['release_date'] || it.payload?.['first_air_date'] || '').trim();
      const released = hasAnyDated
        ? isPartReleased({ id: Number(it.id), title: it.title, release_date: rawDate }, todayIso)
        : true;

      if (released || isWatched) {
        releasedCount++;
      } else {
        upcomingCount++;
      }

      if (isWatched) {
        watched++;
      } else if (isWatchlist) {
        watchlist++;
      }

      if (!isWatched && released && !upNextItem) {
        upNextItem = it;
        upNextYear = rawDate.length >= 4 ? rawDate.slice(0, 4) : '';
      }
    }

    const effectiveTotal = releasedCount > 0 ? releasedCount : items.length;
    const percentage = effectiveTotal > 0 ? Math.min(100, Math.round((watched / effectiveTotal) * 100)) : 0;

    return {
      watched,
      watchlist,
      total: effectiveTotal,
      upcomingCount,
      percentage,
      upNextItem,
      upNextYear
    };
  });

  public mediaTypeCounts = computed(() => {
    const items = this.rawItems();
    let movies = 0;
    let tv = 0;
    for (const it of items) {
      if (it.mediaType === 'tv') tv++;
      else movies++;
    }
    return { all: items.length, movies, tv };
  });

  public libraryCounts = computed(() => {
    const items = this.rawItems();
    const watchedKeys = this.storageService.watchedMediaKeys();
    const watchlistDocs = this.storageService.watchlistItems();
    const watchlistKeys = new Set(watchlistDocs.map((d) => d.id));

    let watched = 0;
    let watchlist = 0;
    let unwatched = 0;

    for (const it of items) {
      const key = `${it.mediaType || 'movie'}_${it.id}`;
      if (watchedKeys.has(key)) {
        watched++;
      } else {
        unwatched++;
        if (watchlistKeys.has(key)) {
          watchlist++;
        }
      }
    }

    return { all: items.length, watched, watchlist, unwatched };
  });

  public displayedCards = computed<CollectionCardVm[]>(() => {
    const mode = this.sortMode();
    const isFranchise = this.isFranchiseCollection();
    let vms = this.rawItems().map((item) => this.toCardVm(item));

    if (isFranchise) {
      const watchedKeys = this.storageService.watchedMediaKeys();
      const watchlistDocs = this.storageService.watchlistItems();
      const watchlistKeys = new Set(watchlistDocs.map((d) => d.id));
      const upNext = this.completionMetrics()?.upNextItem;

      // 0. Assign canonical chronological watch order (#1, #2, #3...) before any filtering
      const chronoSorted = [...vms].sort((a, b) => {
        if (!a.yearValue && !b.yearValue) return 0;
        if (!a.yearValue) return 1;
        if (!b.yearValue) return -1;
        return a.yearValue.localeCompare(b.yearValue);
      });

      chronoSorted.forEach((card, index) => {
        const key = `${card.item.mediaType || 'movie'}_${card.item.id}`;
        card.chronologicalOrder = index + 1;
        card.isWatched = watchedKeys.has(key);
        card.isUpNext = Boolean(
          upNext &&
          Number(upNext.id) === Number(card.item.id) &&
          (upNext.mediaType || 'movie') === (card.item.mediaType || 'movie')
        );
      });

      vms = chronoSorted;

      // 1. Media Type Filter
      const mFilter = this.mediaTypeFilter();
      if (mFilter !== 'all') {
        vms = vms.filter((card) => card.item.mediaType === mFilter);
      }

      // 2. Library Status Filter
      const lFilter = this.libraryFilter();
      if (lFilter !== 'all') {
        vms = vms.filter((card) => {
          const key = `${card.item.mediaType || 'movie'}_${card.item.id}`;
          const isWatched = watchedKeys.has(key);
          const isWatchlist = watchlistKeys.has(key);

          if (lFilter === 'watched') return isWatched;
          if (lFilter === 'watchlist') return isWatchlist;
          if (lFilter === 'unwatched') return !isWatched;
          return true;
        });
      }

      // 3. Franchise Sorting
      if (mode === 'rating') {
        return [...vms].sort((a, b) => b.ratingValue - a.ratingValue);
      }
      if (mode === 'newest') {
        return [...vms].sort((a, b) => b.yearValue.localeCompare(a.yearValue));
      }
      if (mode === 'alpha') {
        return [...vms].sort((a, b) => a.item.title.localeCompare(b.item.title));
      }
      // Default: Chronological (Oldest First, already sorted in step 0)
      return vms;
    }

    // Standard Non-Franchise Discovery Pipeline
    const f = this.filters();
    const minRating = f.minRating;
    if (minRating !== null) {
      vms = vms.filter((card) => card.ratingValue >= minRating);
    }
    if (f.recentOnly) {
      vms = vms.filter((card) => {
        const y = parseInt(card.yearValue, 10);
        return !isNaN(y) && y >= 2023;
      });
    }
    if (f.highVotesOnly) {
      vms = vms.filter((card) => {
        const count = (card.item.payload?.['vote_count'] as number | undefined) || 0;
        return count >= 100;
      });
    }
    if (f.genres.length > 0) {
      vms = vms.filter((card) => {
        const genreIds = (card.item.payload?.['genre_ids'] as number[] | undefined) || [];
        const targetIds = f.genres.flatMap((k) => {
          const g = GENRE_MAP[k];
          return g ? [g.movie, g.tv] : [];
        });
        return targetIds.some((id) => genreIds.includes(id));
      });
    }

    if (mode === 'rating') {
      return [...vms].sort((a, b) => b.ratingValue - a.ratingValue);
    }
    if (mode === 'newest') {
      return [...vms].sort((a, b) => b.yearValue.localeCompare(a.yearValue));
    }
    if (mode === 'alpha') {
      return [...vms].sort((a, b) => a.item.title.localeCompare(b.item.title));
    }
    return vms;
  });

  constructor() {
    addIcons({
      arrowBackOutline, star, homeOutline, albumsOutline, filmOutline,
      tvOutline, checkmarkCircle, checkmarkDoneOutline, checkmarkSharp, addCircleOutline, playForwardOutline, bookmarkOutline, bookmark, sparkles, sparklesOutline, timeOutline, swapVerticalOutline, syncOutline, gitMergeOutline, gitBranchOutline
    });

    effect(() => {
      const job = this.currentUniverseJob();
      if (job && job.resolvedParts && job.resolvedParts.length > 0) {
        const parts = job.resolvedParts;
        const currentCount = this.rawItems().length;
        if (parts.length > currentCount) {
          const items: SwimlaneItem[] = parts.map((part) => ({
            id: part.id,
            mediaType: part.mediaType || 'movie',
            title: part.title,
            posterUrl: resolveMediaImageUrl(part.poster_path, 'w500'),
            bookmarkState: 'none',
            payload: part as unknown as Record<string, unknown>
          }));
          this.rawItems.set(items);
          this.cdr.detectChanges();
        }
      }
    });

    effect(() => {
      const completed = this.franchiseIntel.lastCompletedUniverse();
      if (!completed) return;
      const currentSummary = this.franchiseSummary();
      const currentKey = String(currentSummary?.universeId || currentSummary?.id || '').replace(/^(universe_)+/, '');
      const completedKey = String(completed.universeId || completed.id).replace(/^(universe_)+/, '');
      if (this.isUniverseCollection() && currentKey && currentKey === completedKey) {
        this.franchiseSummary.set(completed);
        const items: SwimlaneItem[] = (completed.parts || []).map((part) => ({
          id: part.id,
          mediaType: part.mediaType || 'movie',
          title: part.title,
          posterUrl: resolveMediaImageUrl(part.poster_path, 'w500'),
          bookmarkState: 'none',
          payload: part as unknown as Record<string, unknown>
        }));
        this.rawItems.set(items);
        this.cdr.detectChanges();
      }
    });
  }

  public activeSortLabel = computed(() => {
    const mode = this.sortMode();
    if (mode === 'newest') return 'Newest';
    if (mode === 'rating') return 'Top Rated';
    if (mode === 'alpha') return 'A–Z';
    return this.isFranchiseCollection() ? 'Timeline' : 'Featured';
  });

  public cycleSortMode(): void {
    const order: CollectionSortMode[] = ['featured', 'newest', 'rating', 'alpha'];
    const currentIdx = order.indexOf(this.sortMode());
    const nextMode = order[(currentIdx + 1) % order.length] || 'featured';
    this.setSortMode(nextMode);
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.mediaTypeFilter.set('all');
        this.libraryFilter.set('all');
        this.sortMode.set('featured');
        void this.content?.scrollToTop(200);
        void this.extractNavigationState();
      });
  }

  public ionViewWillEnter(): void {
    void this.extractNavigationState();
  }

  private async extractNavigationState(): Promise<void> {
    const navState = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as {
      title?: string;
      items?: SwimlaneItem[];
      queryContext?: CollectionQueryContext;
      seedUniverse?: FranchiseCollectionSummary;
      preview?: { id?: number | string; name?: string; posterUrl?: string; backdropUrl?: string };
    } | undefined;

    const idParam = this.route.snapshot.paramMap.get('id');
    const qParams = this.route.snapshot.queryParams;

    // Apply preview state if present
    if (navState?.preview) {
      if (navState.preview.name) this.collectionTitle.set(navState.preview.name);
      if (navState.preview.backdropUrl) this.collectionBackdrop.set(navState.preview.backdropUrl);
    }

    // Fast-path: Instant Frame-0 hydration from active seed universe if freshly ascended
    if (navState?.seedUniverse) {
      const seedUni = navState.seedUniverse;
      this.collectionTitle.set(seedUni.name);
      this.collectionOverview.set(seedUni.connectionInsight || seedUni.overview || null);
      if (seedUni.backdrop_path) {
        this.collectionBackdrop.set(resolveMediaImageUrl(seedUni.backdrop_path, 'w1280'));
      }
      this.isFranchiseCollection.set(true);
      this.isUniverseCollection.set(true);
      this.franchiseSummary.set(seedUni);
      this.numericCollectionId.set(null);

      const items: SwimlaneItem[] = (seedUni.parts || []).map((part) => ({
        id: part.id,
        mediaType: part.mediaType || 'movie',
        title: part.title,
        posterUrl: resolveMediaImageUrl(part.poster_path, 'w500'),
        bookmarkState: 'none',
        payload: part as unknown as Record<string, unknown>
      }));
      this.rawItems.set(items);
      this.hasMore.set(false);
      this.cdr.detectChanges();
      return;
    }

    // 1. Check if route has an ID parameter (TMDB Collection ID or Ascended Universe ID)
    if (idParam) {
      const isUniverseId = idParam.startsWith('universe_') || isNaN(Number(idParam));

      if (isUniverseId) {
        // Find in saved universes RxDB (normalize prefix and prefer most complete canon if legacy duplicate exists)
        const cleanParamKey = idParam.replace(/^(universe_)+/, '');
        const saved = this.storageService.savedUniverses();
        const matches = saved.filter((d) => {
          const p = d.payload as unknown as FranchiseCollectionSummary | undefined;
          const docClean = d.id.replace(/^(universe_)+/, '');
          const pUniClean = String(p?.universeId || p?.id || '').replace(/^(universe_)+/, '');
          return (
            docClean === cleanParamKey ||
            pUniClean === cleanParamKey ||
            d.id === idParam ||
            String(d.tmdbId) === idParam
          );
        });
        const found = matches.sort((a, b) => {
          const pA = a.payload as unknown as FranchiseCollectionSummary | undefined;
          const pB = b.payload as unknown as FranchiseCollectionSummary | undefined;
          return (pB?.parts?.length || 0) - (pA?.parts?.length || 0);
        })[0];

        if (found) {
          const uni = found.payload as unknown as FranchiseCollectionSummary;
          const nonCollectionPattern = /disney\+|canon series|tv series|television|phase\s*\d|streaming|one-shots|specials/i;
          const initialSiblings = (uni.siblingFranchises || []).filter((s) => s?.name && !nonCollectionPattern.test(s.name));
          const displayUni: FranchiseCollectionSummary = {
            ...uni,
            siblingFranchises: initialSiblings
          };

          this.collectionTitle.set(displayUni.name);
          this.collectionOverview.set(displayUni.connectionInsight || displayUni.overview || null);
          const fallbackBackdrop = displayUni.backdrop_path || displayUni.parts?.find((p) => p.backdrop_path)?.backdrop_path || null;
          this.collectionBackdrop.set(fallbackBackdrop ? resolveMediaImageUrl(fallbackBackdrop, 'w1280') : null);
          this.isFranchiseCollection.set(true);
          this.isUniverseCollection.set(true);
          this.franchiseSummary.set(displayUni);
          this.numericCollectionId.set(null);

          const items: SwimlaneItem[] = (displayUni.parts || []).map((part) => ({
            id: part.id,
            mediaType: part.mediaType || 'movie',
            title: part.title,
            posterUrl: resolveMediaImageUrl(part.poster_path, 'w500'),
            bookmarkState: 'none',
            payload: part as unknown as Record<string, unknown>
          }));
          this.rawItems.set(items);
          this.hasMore.set(false);
          this.cdr.detectChanges();

          // Self-heal existing saved universe: verify sibling collections and expand canon with live TMDB 2024-2027+ releases
          const isAlreadyExpandedV2 = Boolean((uni as unknown as { canonExpandedV2?: boolean }).canonExpandedV2);
          const needsSiblingVerification = (uni.siblingFranchises || []).some(
            (s) => !s.id || s.id <= 0 || (s.id >= 90000 && s.id <= 90100) || nonCollectionPattern.test(s.name) || /\b(saga|mcu|dceu)\b/i.test(s.name)
          );
          if (!isAlreadyExpandedV2 || needsSiblingVerification) {
            void this.syncUniverseCanon(true);
          }
          return;
        }
      }

      // Check numeric TMDB collection ID
      const numId = parseInt(idParam, 10);
      if (!isNaN(numId)) {
        this.numericCollectionId.set(numId);
        this.isFranchiseCollection.set(true);
        this.isUniverseCollection.set(false);
        this.isLoadingMore.set(true);

        const cached = await this.franchiseAggregator.getCollectionMetadata(numId);
        if (cached) {
          this.collectionTitle.set(cached.name);
          this.collectionOverview.set(cached.overview || null);
          const fallbackBackdrop = cached.backdrop_path || cached.parts?.find((p) => p.backdrop_path)?.backdrop_path || null;
          this.collectionBackdrop.set(fallbackBackdrop ? resolveMediaImageUrl(fallbackBackdrop, 'w1280') : null);
          this.franchiseSummary.set({
            id: numId,
            name: cached.name,
            overview: cached.overview,
            poster_path: cached.poster_path ?? cached.parts?.find((p) => p.poster_path)?.poster_path ?? null,
            backdrop_path: fallbackBackdrop,
            totalParts: cached.totalParts,
            collectedCount: 0,
            watchedCount: 0,
            watchlistCount: 0,
            completionPercentage: 0,
            isUniverse: false,
            parts: cached.parts
          });

          const items: SwimlaneItem[] = (cached.parts || []).map((p) => ({
            id: p.id,
            mediaType: 'movie',
            title: p.title,
            posterUrl: resolveMediaImageUrl(p.poster_path, 'w500'),
            bookmarkState: 'none',
            payload: p as unknown as Record<string, unknown>
          }));
          this.rawItems.set(items);
          this.hasMore.set(false);
          this.isLoadingMore.set(false);
          this.cdr.detectChanges();
          return;
        }

        // Offline Fallback: Check if user saved this numeric franchise in RxDB
        const savedDoc = this.storageService.savedUniverses().find((d) => d.id === `franchise_${numId}` || d.tmdbId === numId);
        if (savedDoc) {
          const savedSummary = savedDoc.payload as unknown as FranchiseCollectionSummary;
          this.collectionTitle.set(savedSummary.name);
          this.collectionOverview.set(savedSummary.overview || null);
          this.collectionBackdrop.set(savedSummary.backdrop_path ? resolveMediaImageUrl(savedSummary.backdrop_path, 'w1280') : null);
          this.franchiseSummary.set(savedSummary);

          const items: SwimlaneItem[] = (savedSummary.parts || []).map((p) => ({
            id: p.id,
            mediaType: p.mediaType || 'movie',
            title: p.title,
            posterUrl: resolveMediaImageUrl(p.poster_path, 'w500'),
            bookmarkState: 'none',
            payload: p as unknown as Record<string, unknown>
          }));
          this.rawItems.set(items);
          this.hasMore.set(false);
          this.isLoadingMore.set(false);
          this.cdr.detectChanges();
          return;
        }
        this.isLoadingMore.set(false);
      }
    }

    const title = navState?.title || qParams['title'] || 'Collection';
    this.collectionTitle.set(title);

    let queryContext = navState?.queryContext;
    if (!queryContext && qParams['type']) {
      const builtContext: CollectionQueryContext = {
        type: qParams['type']
      };
      if (qParams['id']) {
        builtContext.id = Number(qParams['id']);
      }
      if (qParams['mediaType'] === 'movie' || qParams['mediaType'] === 'tv') {
        builtContext.mediaType = qParams['mediaType'];
      }
      queryContext = builtContext;
    }
    this.queryContext.set(queryContext);

    if (Array.isArray(navState?.items) && navState.items.length > 0) {
      this.rawItems.set(navState.items);
      this.currentPage.set(1);
      if (navState.items.length < 15 && !queryContext) {
        this.hasMore.set(false);
      } else {
        this.hasMore.set(true);
      }
    } else if (this.rawItems().length === 0) {
      void this.fetchInitialCollectionPage();
    }
  }

  private async fetchInitialCollectionPage(): Promise<void> {
    const title = this.collectionTitle();
    if (!title && !this.queryContext()) return;
    this.isFetchingMore = true;
    this.isLoadingMore.set(true);
    try {
      const res = await this.collectionLoader.fetchPage(
        title,
        1,
        this.sortMode(),
        this.queryContext(),
        this.filters()
      );
      this.rawItems.set(res.items);
      this.currentPage.set(1);
      this.hasMore.set(res.hasMore);

      // Hydrate backdrop from first item's collection payload if available
      if (!this.collectionBackdrop() && res.items.length > 0) {
        const payload = res.items[0].payload;
        const colBackdrop = payload?.['collection_backdrop_path'] as string | undefined;
        if (colBackdrop) {
          this.collectionBackdrop.set(resolveMediaImageUrl(colBackdrop, 'w1280'));
        }
      }

      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load initial collection items:', err);
    } finally {
      this.isFetchingMore = false;
      this.isLoadingMore.set(false);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      void this.checkAndPreloadNext();
    }, 250);
  }

  public goBack(): void {
    if (window.history.length > 1) {
      this.navCtrl.back();
    } else {
      this.navCtrl.navigateRoot('/tabs/discover', { animationDirection: 'back' });
    }
  }

  public goToHome(): void {
    this.navService.navigateToHome();
  }

  public onScroll(): void {
    if (this.isFetchingMore || !this.hasMore()) return;
    if (this.scrollThrottleTimer) return;
    this.scrollThrottleTimer = setTimeout(() => {
      this.scrollThrottleTimer = null;
      void this.checkAndPreloadNext();
    }, 120);
  }

  private async checkAndPreloadNext(): Promise<void> {
    if (this.isFetchingMore || !this.hasMore()) return;

    const scrollEl = await this.content?.getScrollElement();
    if (!scrollEl) return;

    const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    if (distanceFromBottom <= 500) {
      void this.loadMore();
    }
  }

  // Dual-Axis Filter Setters
  public setMediaTypeFilter(filter: 'all' | 'movie' | 'tv'): void {
    this.mediaTypeFilter.set(filter);
    void this.content?.scrollToTop(150);
  }

  public setLibraryFilter(filter: 'all' | 'watched' | 'watchlist' | 'unwatched'): void {
    this.libraryFilter.set(filter);
    void this.content?.scrollToTop(150);
  }

  public toggleRatingFilter(): void {
    const current = this.filters().minRating;
    void this.updateFilters({ minRating: current === null ? 7.0 : null });
  }

  public toggleRecentFilter(): void {
    void this.updateFilters({ recentOnly: !this.filters().recentOnly });
  }

  public toggleHighVotesFilter(): void {
    void this.updateFilters({ highVotesOnly: !this.filters().highVotesOnly });
  }

  public toggleGenreFilter(genreKey: string): void {
    const currentGenres = this.filters().genres;
    const nextGenres = currentGenres.includes(genreKey)
      ? currentGenres.filter((g) => g !== genreKey)
      : [...currentGenres, genreKey];
    void this.updateFilters({ genres: nextGenres });
  }

  public resetFilters(): void {
    if (this.isFranchiseCollection()) {
      this.mediaTypeFilter.set('all');
      this.libraryFilter.set('all');
      return;
    }
    void this.updateFilters({
      minRating: null,
      recentOnly: false,
      highVotesOnly: false,
      genres: []
    });
  }

  private async updateFilters(partial: Partial<CollectionFilterOptions>): Promise<void> {
    const updated: CollectionFilterOptions = { ...this.filters(), ...partial };
    this.filters.set(updated);

    const title = this.collectionTitle();
    const isServer = this.collectionLoader.isServerSortable(title, this.queryContext());

    void this.content?.scrollToTop(200);

    if (isServer) {
      this.currentPage.set(1);
      this.hasMore.set(true);
      this.isFetchingMore = true;
      this.isLoadingMore.set(true);

      try {
        const res = await this.collectionLoader.fetchPage(
          title,
          1,
          this.sortMode(),
          this.queryContext(),
          updated
        );
        this.rawItems.set(res.items);
        this.hasMore.set(res.hasMore);
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Failed to load filtered collection page:', err);
      } finally {
        this.isFetchingMore = false;
        this.isLoadingMore.set(false);
      }
    } else {
      this.cdr.detectChanges();
      if (this.displayedCards().length < 15 && this.hasMore()) {
        void this.checkAndPreloadNext();
      }
    }
  }

  public async setSortMode(mode: CollectionSortMode): Promise<void> {
    if (this.sortMode() === mode) return;

    void this.content?.scrollToTop(250);

    const title = this.collectionTitle();
    const isServerSortable = this.collectionLoader.isServerSortable(title, this.queryContext());

    if (isServerSortable) {
      this.sortMode.set(mode);
      this.currentPage.set(1);
      this.hasMore.set(true);
      this.isFetchingMore = true;
      this.isLoadingMore.set(true);

      try {
        const res = await this.collectionLoader.fetchPage(
          title,
          1,
          mode,
          this.queryContext(),
          this.filters()
        );
        this.rawItems.set(res.items);
        this.hasMore.set(res.hasMore);
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Failed to load sorted collection page:', err);
      } finally {
        this.isFetchingMore = false;
        this.isLoadingMore.set(false);
      }
    } else {
      if (mode !== 'featured' && this.rawItems().length <= 20 && this.hasMore()) {
        this.isFetchingMore = true;
        this.isLoadingMore.set(true);
        try {
          const [p2, p3] = await Promise.all([
            this.collectionLoader.fetchPage(title, 2, 'featured', this.queryContext(), this.filters()),
            this.collectionLoader.fetchPage(title, 3, 'featured', this.queryContext(), this.filters())
          ]);
          const existingIds = new Set(this.rawItems().map((i) => i.id));
          const newItems = [...p2.items, ...p3.items].filter((i) => !existingIds.has(i.id));
          this.rawItems.update((curr) => [...curr, ...newItems]);
          this.currentPage.set(3);
          this.hasMore.set(p3.hasMore);
          this.cdr.detectChanges();
        } catch (err) {
          console.warn('Failed to prefetch buffer for client sort:', err);
        } finally {
          this.isFetchingMore = false;
          this.isLoadingMore.set(false);
        }
      }
      this.sortMode.set(mode);
    }
  }

  public async loadMore(event?: Event): Promise<void> {
    const infiniteTarget =
      (event?.target as HTMLIonInfiniteScrollElement | null) ||
      (this.infiniteScroll as unknown as HTMLIonInfiniteScrollElement | undefined);

    if (this.isFetchingMore || !this.hasMore()) {
      await infiniteTarget?.complete?.();
      return;
    }

    this.isFetchingMore = true;
    this.isLoadingMore.set(true);
    const nextPage = this.currentPage() + 1;

    try {
      const res = await this.collectionLoader.fetchPage(
        this.collectionTitle(),
        nextPage,
        this.sortMode(),
        this.queryContext(),
        this.filters()
      );

      if (res.items.length > 0) {
        const existingIds = new Set(this.rawItems().map((i) => `${i.mediaType || 'media'}-${i.id}`));
        const unique = res.items.filter((i) => !existingIds.has(`${i.mediaType || 'media'}-${i.id}`));
        if (unique.length > 0) {
          this.rawItems.update((curr) => [...curr, ...unique]);
        }
        this.currentPage.set(nextPage);

        if (unique.length === 0 && res.hasMore) {
          this.isFetchingMore = false;
          this.isLoadingMore.set(false);
          void this.loadMore();
          return;
        }
      }

      const canContinue = res.hasMore && res.items.length > 0;
      this.hasMore.set(canContinue);
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load more collection items:', err);
      this.hasMore.set(false);
    } finally {
      this.isFetchingMore = false;
      this.isLoadingMore.set(false);
      await infiniteTarget?.complete?.();

      if (this.hasMore()) {
        await this.checkAndPreloadNext();
      }
    }
  }

  // ==========================================
  // AI UNIVERSE REASONING & ASCENSION
  // ==========================================

  public openActiveUniverseJob(job: { universeId: string; universeTitle: string }): void {
    void this.router.navigate(['/collection', job.universeId], {
      state: {
        title: job.universeTitle,
        preview: {
          id: job.universeId,
          name: job.universeTitle
        }
      }
    });
  }

  public async triggerDiscoverUniverse(): Promise<void> {
    if (this.isAnalyzingUniverse()) {
      return;
    }
    const colId = this.numericCollectionId();
    if (!colId) return;

    const cooldown = this.franchiseIntel.getCooldownStatus(colId);
    if (cooldown.isCooldown) {
      await this.toastService.presentInfo(
        `Next scan available in ${cooldown.hoursRemaining} hrs`,
        2500
      );
      return;
    }

    this.isAnalyzingUniverse.set(true);

    try {
      const parts: FranchisePart[] = this.rawItems().map((it) => ({
        id: Number(it.id),
        title: it.title,
        mediaType: it.mediaType === 'tv' ? 'tv' : 'movie'
      }));

      const res = await this.franchiseIntel.analyzeUniverse(colId, this.collectionTitle(), parts);

      if (res.isCancelled) {
        return;
      }
      if (res.isCooldown) {
        await this.toastService.presentInfo(
          res.message || `Next scan available in ${res.hoursRemaining || 3} hrs`,
          2500
        );
        return;
      }

      if (res.data?.isSharedUniverse && res.data.universeTitle) {
        this.universeProposal.set(res.data);
        this.showUniverseModal.set(true);
      } else {
        await this.toastService.presentInfo(
          'This is a self-contained saga with no separate shared universe.',
          2200
        );
      }
    } catch {
      await this.toastService.presentError('Failed to analyze universe. Please try again.', 2000);
    } finally {
      this.isAnalyzingUniverse.set(false);
      this.cdr.detectChanges();
    }
  }

  public openExistingUniverse(uni: FranchiseCollectionSummary): void {
    const targetId = uni.universeId || uni.id;
    void this.router.navigate(['/collection', targetId], {
      state: {
        title: uni.name,
        preview: {
          id: targetId,
          name: uni.name,
          backdropUrl: uni.backdrop_path ? resolveMediaImageUrl(uni.backdrop_path, 'w1280') : undefined
        }
      }
    });
  }

  public async onSiblingFranchiseClick(sib: { id: number; name: string }): Promise<void> {
    const isSyntheticId = !sib.id || sib.id <= 0 || (sib.id >= 90000 && sib.id <= 90100);
    if (!isSyntheticId) {
      void this.router.navigate(['/collection', sib.id], {
        state: {
          title: sib.name,
          preview: {
            id: sib.id,
            name: sib.name
          }
        }
      });
      return;
    }

    const verified = await this.franchiseIntel.resolveSiblingCollections([sib]);
    const match = verified[0];
    if (match && match.id > 0) {
      void this.router.navigate(['/collection', match.id], {
        state: {
          title: match.name,
          preview: {
            id: match.id,
            name: match.name
          }
        }
      });
      return;
    }

    await this.toastService.presentInfo(`"${sib.name}" is already included in this universe timeline.`, 2000);
  }

  public async markUpNextAsWatched(event: Event, item: SwimlaneItem): Promise<void> {
    event.stopPropagation();
    const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
    const numId = this.numericCollectionId();
    const collectionRef = numId ? {
      id: numId,
      name: this.collectionTitle(),
      poster_path: this.franchiseSummary()?.poster_path,
      backdrop_path: this.franchiseSummary()?.backdrop_path
    } : undefined;

    const payload = item.payload
      ? {
          ...(item.payload as Record<string, unknown>),
          belongs_to_collection: (item.payload as Record<string, unknown>)['belongs_to_collection'] || collectionRef
        }
      : {
          id: Number(item.id),
          title: item.title,
          name: item.title,
          posterUrl: item.posterUrl,
          media_type: mediaType,
          belongs_to_collection: collectionRef
        };

    const moved = await this.storageService.moveToWatched(Number(item.id), mediaType, payload);
    if (moved) {
      await this.toastService.presentInfo(`Marked "${item.title}" as Watched`, 1800);
    } else {
      await this.toastService.presentWarning(`Cannot mark "${item.title}" as Watched — not released yet`, 2000);
    }
  }

  public async markAllReleasedAsWatched(): Promise<void> {
    const items = this.rawItems();
    if (items.length === 0) return;

    const watchedKeys = this.storageService.watchedMediaKeys();
    const numId = this.numericCollectionId();
    const collectionRef = numId ? {
      id: numId,
      name: this.collectionTitle(),
      poster_path: this.franchiseSummary()?.poster_path,
      backdrop_path: this.franchiseSummary()?.backdrop_path
    } : undefined;

    let markedCount = 0;
    for (const item of items) {
      if (item.mediaType === 'person') continue;
      const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
      const key = `${mediaType}_${item.id}`;
      if (watchedKeys.has(key)) continue;

      const payload = item.payload
        ? {
            ...(item.payload as Record<string, unknown>),
            belongs_to_collection: (item.payload as Record<string, unknown>)['belongs_to_collection'] || collectionRef
          }
        : {
            id: Number(item.id),
            title: item.title,
            name: item.title,
            posterUrl: item.posterUrl,
            media_type: mediaType,
            belongs_to_collection: collectionRef
          };

      if (!this.storageService.checkReleaseStatus(payload).isReleased) {
        continue; // Skip unreleased future titles
      }

      const moved = await this.storageService.moveToWatched(Number(item.id), mediaType, payload);
      if (moved) {
        markedCount++;
      }
    }

    if (markedCount > 0) {
      await this.toastService.presentSuccess(`Marked ${markedCount} released titles as Watched`, 2200);
    }
  }

  public async syncUniverseCanon(silent = false): Promise<void> {
    const uni = this.franchiseSummary();
    if (!uni || !this.isUniverseCollection() || this.isSyncingUniverse()) return;

    this.isSyncingUniverse.set(true);
    try {
      const verifiedSiblings = await this.franchiseIntel.resolveSiblingCollections(uni.siblingFranchises || []);

      // If user clicked manual Sync, also check if AI has newer canon titles for the first sibling collection
      let baseParts: FranchisePart[] = [...(uni.parts || [])];
      if (!silent && verifiedSiblings.length > 0 && verifiedSiblings[0]) {
        const seedSib = verifiedSiblings[0];
        const aiRes = await this.franchiseIntel.analyzeUniverse(seedSib.id, seedSib.name, baseParts, true);
        if (aiRes.data?.canonTitles?.length) {
          const aiParts = await this.franchiseIntel.resolveCanonItems(aiRes.data.canonTitles, baseParts);
          const mapByKey = new Map<string, FranchisePart>();
          for (const p of [...baseParts, ...aiParts]) {
            mapByKey.set(`${p.mediaType || 'movie'}_${p.id}`, p);
          }
          baseParts = Array.from(mapByKey.values());
        }
      }

      const expandedParts = await this.franchiseIntel.expandUniverseWithLiveTmdb(
        uni.name,
        String(uni.universeId || uni.id),
        baseParts,
        verifiedSiblings
      );

      const addedCount = Math.max(0, expandedParts.length - (uni.parts?.length || 0));
      const updatedUni: FranchiseCollectionSummary & { canonExpandedV2?: boolean } = {
        ...uni,
        totalParts: expandedParts.length,
        parts: expandedParts,
        siblingFranchises: verifiedSiblings,
        canonExpandedV2: true
      };

      this.franchiseSummary.set(updatedUni);
      const items: SwimlaneItem[] = expandedParts.map((part) => ({
        id: part.id,
        mediaType: part.mediaType || 'movie',
        title: part.title,
        posterUrl: resolveMediaImageUrl(part.poster_path, 'w500'),
        bookmarkState: 'none',
        payload: part as unknown as Record<string, unknown>
      }));
      this.rawItems.set(items);
      this.cdr.detectChanges();

      const targetUniKey = String(uni.universeId || uni.id).replace(/^universe_/, '');
      await this.storageService.saveUniverse(targetUniKey, updatedUni);

      if (!silent) {
        if (addedCount > 0) {
          await this.toastService.presentSuccess(`Synced Universe: +${addedCount} new Movie & TV titles added!`, 2200);
        } else {
          await this.toastService.presentInfo(`Universe timeline is up to date (${expandedParts.length} titles).`, 1800);
        }
      }
    } catch {
      if (!silent) {
        await this.toastService.presentError('Failed to sync universe canon.', 1800);
      }
    } finally {
      this.isSyncingUniverse.set(false);
      this.cdr.detectChanges();
    }
  }

  public confirmAscension(event?: { foldSubCollection: boolean }): void {
    const proposal = this.universeProposal();
    if (!proposal) return;

    // 1. Immediately close the modal so the user is never blocked or trapped
    this.showUniverseModal.set(false);
    this.isResolvingCanon.set(false);

    const currentParts: FranchisePart[] = this.rawItems().map((it) => {
      const p = it.payload as Record<string, unknown> | undefined;
      return {
        id: Number(it.id),
        title: it.title,
        mediaType: it.mediaType === 'tv' ? 'tv' : 'movie',
        overview: p?.['overview'] as string | undefined,
        poster_path: (p?.['poster_path'] || it.posterUrl) as string | undefined,
        backdrop_path: p?.['backdrop_path'] as string | undefined,
        release_date: p?.['release_date'] as string | undefined,
        first_air_date: p?.['first_air_date'] as string | undefined,
        vote_average: p?.['vote_average'] as number | undefined,
        vote_count: p?.['vote_count'] as number | undefined
      };
    });

    const colId = this.numericCollectionId();
    const buildResult = this.franchiseIntel.startBackgroundUniverseBuild({
      proposal,
      currentParts,
      seedCollection: colId ? { id: colId, name: this.collectionTitle() } : undefined,
      fallbackOverview: this.collectionOverview(),
      fallbackBackdropPath: this.franchiseSummary()?.backdrop_path,
      fallbackPosterPath: this.franchiseSummary()?.poster_path,
      foldSubCollection: event?.foldSubCollection !== false
    });

    void this.router.navigate(['/collection', buildResult.universeId], {
      state: {
        title: buildResult.universeTitle,
        seedUniverse: buildResult.seedSummary,
        preview: {
          id: buildResult.universeId,
          name: buildResult.universeTitle,
          backdropUrl: buildResult.seedSummary.backdrop_path
            ? resolveMediaImageUrl(buildResult.seedSummary.backdrop_path, 'w1280')
            : undefined
        }
      }
    });
    this.cdr.detectChanges();
  }

  public getBookmarkState(item: SwimlaneItem): BookmarkState {
    if (item.mediaType === 'person') return 'none';
    const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
    return this.storageService.getBookmarkState(item.id, mediaType);
  }

  public onCardClick(item: SwimlaneItem): void {
    if (item.mediaType === 'person') {
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
      return;
    }
    const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
    const rawBackdrop = item.payload?.['backdrop_path'] as string | undefined;
    void this.router.navigate(['/media', mediaType, item.id], {
      state: {
        preview: {
          id: Number(item.id),
          mediaType,
          title: item.title,
          posterUrl: item.posterUrl,
          backdropUrl: rawBackdrop ? resolveMediaImageUrl(rawBackdrop, 'w1280') : undefined
        }
      }
    });
  }

  public async onToggleBookmark(item: SwimlaneItem): Promise<void> {
    if (item.mediaType === 'person') return;
    const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
    const numId = this.numericCollectionId();
    const collectionRef = numId ? {
      id: numId,
      name: this.collectionTitle(),
      poster_path: this.franchiseSummary()?.poster_path,
      backdrop_path: this.franchiseSummary()?.backdrop_path
    } : undefined;

    const payload = item.payload
      ? {
          ...(item.payload as Record<string, unknown>),
          belongs_to_collection: (item.payload as Record<string, unknown>)['belongs_to_collection'] || collectionRef
        }
      : {
          id: Number(item.id),
          title: item.title,
          name: item.title,
          posterUrl: item.posterUrl,
          media_type: mediaType,
          belongs_to_collection: collectionRef
        };

    const prevState = this.getBookmarkState(item);
    const nextState = await this.storageService.cycleBookmark(Number(item.id), mediaType, payload);
    if (nextState === 'watchlist') {
      await this.toastService.presentSuccess(`Added "${item.title}" to Watchlist`, 1800);
    } else if (nextState === 'watched') {
      await this.toastService.presentInfo(`Marked "${item.title}" as Watched`, 1800);
    } else if (prevState === 'watchlist') {
      await this.toastService.presentWarning(`Removed "${item.title}" from Watchlist (not released yet — cannot mark Watched)`, 2200);
    } else {
      await this.toastService.presentWarning(`Removed "${item.title}" from Archive`, 1800);
    }
  }

  public async toggleSaveCurrentFranchise(): Promise<void> {
    if (this.isUniverseCollection()) {
      const currentUniSummary = this.franchiseSummary();
      const uniId = currentUniSummary?.universeId || currentUniSummary?.id;
      if (!uniId) return;
      if (this.isCurrentFranchiseSaved()) {
        await this.franchiseAggregator.untrackFranchise(uniId, true);
        await this.toastService.presentWarning(`Untracked "${this.collectionTitle()}" from Franchises`, 1800);
      } else if (currentUniSummary) {
        await this.franchiseAggregator.trackFranchise(String(uniId), currentUniSummary);
        await this.toastService.presentSuccess(`Tracking "${this.collectionTitle()}" in Franchises`, 1800);
      }
      return;
    }

    const numId = this.numericCollectionId();
    const targetId = numId || this.queryContext()?.id;
    if (!targetId) return;

    if (this.isCurrentFranchiseSaved()) {
      await this.franchiseAggregator.untrackFranchise(targetId, false);
      await this.toastService.presentWarning(`Untracked "${this.collectionTitle()}" from Franchises`, 1800);
    } else {
      const existingSummary = this.franchiseSummary();
      const firstPoster = existingSummary?.poster_path
        || (this.rawItems()[0]?.payload?.['poster_path'] as string | undefined)
        || this.rawItems()[0]?.posterUrl;
      const firstBackdrop = existingSummary?.backdrop_path
        || (this.rawItems()[0]?.payload?.['backdrop_path'] as string | undefined)
        || this.collectionBackdrop()
        || undefined;

      const summary: FranchiseCollectionSummary = {
        id: targetId,
        name: this.collectionTitle(),
        overview: this.collectionOverview() || existingSummary?.overview || undefined,
        poster_path: firstPoster,
        backdrop_path: firstBackdrop,
        totalParts: this.completionMetrics()?.total || this.rawItems().length,
        collectedCount: this.completionMetrics()?.watched || 0,
        watchedCount: this.completionMetrics()?.watched || 0,
        watchlistCount: this.completionMetrics()?.watchlist || 0,
        completionPercentage: this.completionMetrics()?.percentage || 0,
        isUniverse: false,
        parts: this.rawItems().map((it) => {
          const p = it.payload as Record<string, unknown> | undefined;
          return {
            id: Number(it.id),
            title: it.title,
            mediaType: (it.mediaType === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv',
            poster_path: (p?.['poster_path'] || it.posterUrl) as string | undefined,
            backdrop_path: p?.['backdrop_path'] as string | undefined,
            release_date: (p?.['release_date'] || p?.['first_air_date']) as string | undefined,
            vote_average: p?.['vote_average'] as number | undefined,
            vote_count: p?.['vote_count'] as number | undefined
          };
        })
      };

      await this.franchiseAggregator.trackFranchise(targetId, summary);
      await this.toastService.presentSuccess(`Tracking "${this.collectionTitle()}" in Franchises`, 1800);
    }
  }

  private toCardVm(item: SwimlaneItem): CollectionCardVm {
    if (item.mediaType === 'person') {
      return {
        item,
        metaLine: item.subtitle ? `Known for: ${item.subtitle}` : 'Actor',
        ratingValue: 0,
        yearValue: '',
        isUpcoming: false
      };
    }

    const payload = item.payload;
    const rawDate = String(payload?.['release_date'] || payload?.['first_air_date'] || '').trim();
    const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : '';
    const rating = Number(payload?.['vote_average'] || 0);
    const isUpcoming = Boolean(this.isFranchiseCollection() && !this.storageService.checkReleaseStatus(payload).isReleased);

    const parts: string[] = [item.mediaType === 'tv' ? 'TV Series' : 'Movie'];
    if (year) parts.push(year);
    else if (isUpcoming) parts.push('TBA');

    return {
      item,
      metaLine: item.subtitle || parts.join(' • '),
      ratingValue: rating,
      yearValue: rawDate,
      isUpcoming
    };
  }
}
