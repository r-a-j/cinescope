import {
  Component, ChangeDetectionStrategy, OnInit, AfterViewInit, inject,
  signal, computed, ViewChild, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, homeOutline, star, albumsOutline, filmOutline,
  tvOutline, checkmarkCircle, bookmarkOutline, bookmark, sparklesOutline, timeOutline
} from 'ionicons/icons';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { NavigationService } from '../../core/services/navigation.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';
import { FranchiseAggregatorService } from '../../core/services/franchise-aggregator.service';
import { FranchiseCollectionSummary } from '../../core/models/franchise.model';
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
}

@Component({
  selector: 'app-collection-page',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, PosterCardComponent],
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
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(IonContent, { static: false }) private content?: IonContent;
  @ViewChild(IonInfiniteScroll, { static: false }) private infiniteScroll?: IonInfiniteScroll;

  public collectionTitle = signal<string>('Collection');
  public collectionBackdrop = signal<string | null>(null);
  public collectionOverview = signal<string | null>(null);
  public isFranchiseCollection = signal<boolean>(false);
  public isUniverseCollection = signal<boolean>(false);
  public franchiseSummary = signal<FranchiseCollectionSummary | null>(null);

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

  public completionMetrics = computed(() => {
    if (!this.isFranchiseCollection()) return null;
    const items = this.rawItems();
    const total = items.length;
    if (total === 0) return { watched: 0, watchlist: 0, total: 0, percentage: 0 };

    const watchedKeys = this.storageService.watchedMediaKeys();
    const watchlistDocs = this.storageService.watchlistItems();
    const watchlistKeys = new Set(watchlistDocs.map((d) => d.id));

    let watched = 0;
    let watchlist = 0;
    for (const it of items) {
      const key = `${it.mediaType || 'movie'}_${it.id}`;
      if (watchedKeys.has(key)) {
        watched++;
      } else if (watchlistKeys.has(key)) {
        watchlist++;
      }
    }
    const percentage = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
    return { watched, watchlist, total, percentage };
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
      } else if (watchlistKeys.has(key)) {
        watchlist++;
      } else {
        unwatched++;
      }
    }

    return { all: items.length, watched, watchlist, unwatched };
  });

  public displayedCards = computed<CollectionCardVm[]>(() => {
    const mode = this.sortMode();
    const isFranchise = this.isFranchiseCollection();
    let vms = this.rawItems().map((item) => this.toCardVm(item));

    if (isFranchise) {
      // 1. Media Type Filter
      const mFilter = this.mediaTypeFilter();
      if (mFilter !== 'all') {
        vms = vms.filter((card) => card.item.mediaType === mFilter);
      }

      // 2. Library Status Filter
      const lFilter = this.libraryFilter();
      if (lFilter !== 'all') {
        const watchedKeys = this.storageService.watchedMediaKeys();
        const watchlistDocs = this.storageService.watchlistItems();
        const watchlistKeys = new Set(watchlistDocs.map((d) => d.id));

        vms = vms.filter((card) => {
          const key = `${card.item.mediaType || 'movie'}_${card.item.id}`;
          const isWatched = watchedKeys.has(key);
          const isWatchlist = watchlistKeys.has(key);

          if (lFilter === 'watched') return isWatched;
          if (lFilter === 'watchlist') return isWatchlist;
          if (lFilter === 'unwatched') return !isWatched && !isWatchlist;
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
      // Default: Chronological (Oldest First)
      return [...vms].sort((a, b) => {
        if (!a.yearValue && !b.yearValue) return 0;
        if (!a.yearValue) return 1;
        if (!b.yearValue) return -1;
        return a.yearValue.localeCompare(b.yearValue);
      });
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
      tvOutline, checkmarkCircle, bookmarkOutline, bookmark, sparklesOutline, timeOutline
    });
  }

  ngOnInit(): void {
    void this.extractNavigationState();
  }

  public ionViewWillEnter(): void {
    void this.extractNavigationState();
  }

  private async extractNavigationState(): Promise<void> {
    const navState = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as {
      title?: string;
      items?: SwimlaneItem[];
      queryContext?: CollectionQueryContext;
      preview?: { id?: number | string; name?: string; posterUrl?: string; backdropUrl?: string };
    } | undefined;

    const idParam = this.route.snapshot.paramMap.get('id');
    const qParams = this.route.snapshot.queryParams;

    // Apply preview state if present
    if (navState?.preview) {
      if (navState.preview.name) this.collectionTitle.set(navState.preview.name);
      if (navState.preview.backdropUrl) this.collectionBackdrop.set(navState.preview.backdropUrl);
    }

    // 1. Check if route has an ID parameter (TMDB Collection ID or Ascended Universe ID)
    if (idParam) {
      const isUniverseId = idParam.startsWith('universe_') || isNaN(Number(idParam));

      if (isUniverseId) {
        // Find in saved universes RxDB
        const saved = this.storageService.savedUniverses();
        const found = saved.find((d) => {
          const p = d.payload as unknown as FranchiseCollectionSummary | undefined;
          return d.id === idParam || d.id === `universe_${idParam}` || p?.universeId === idParam || String(d.tmdbId) === idParam;
        });

        if (found) {
          const uni = found.payload as unknown as FranchiseCollectionSummary;
          this.collectionTitle.set(uni.name);
          this.collectionOverview.set(uni.overview || null);
          this.collectionBackdrop.set(uni.backdrop_path ? resolveMediaImageUrl(uni.backdrop_path, 'w1280') : null);
          this.isFranchiseCollection.set(true);
          this.isUniverseCollection.set(true);
          this.franchiseSummary.set(uni);

          const items: SwimlaneItem[] = (uni.parts || []).map((part) => ({
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
      }

      // Check numeric TMDB collection ID
      const numId = parseInt(idParam, 10);
      if (!isNaN(numId)) {
        this.isFranchiseCollection.set(true);
        this.isUniverseCollection.set(false);
        this.isLoadingMore.set(true);

        const cached = await this.franchiseAggregator.getCollectionMetadata(numId);
        if (cached) {
          this.collectionTitle.set(cached.name);
          this.collectionOverview.set(cached.overview || null);
          this.collectionBackdrop.set(cached.backdrop_path ? resolveMediaImageUrl(cached.backdrop_path, 'w1280') : null);

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
    const payload = item.payload || {
      id: Number(item.id),
      title: item.title,
      name: item.title,
      posterUrl: item.posterUrl,
      media_type: mediaType
    };

    const nextState = await this.storageService.cycleBookmark(Number(item.id), mediaType, payload);
    if (nextState === 'watchlist') {
      await this.toastService.presentSuccess(`Added "${item.title}" to Watchlist`, 1800);
    } else if (nextState === 'watched') {
      await this.toastService.presentInfo(`Marked "${item.title}" as Watched`, 1800);
    } else {
      await this.toastService.presentWarning(`Removed "${item.title}" from Archive`, 1800);
    }
  }

  private toCardVm(item: SwimlaneItem): CollectionCardVm {
    if (item.mediaType === 'person') {
      return {
        item,
        metaLine: item.subtitle ? `Known for: ${item.subtitle}` : 'Actor',
        ratingValue: 0,
        yearValue: ''
      };
    }

    const payload = item.payload;
    const rawDate = String(payload?.['release_date'] || payload?.['first_air_date'] || '');
    const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : '';
    const rating = Number(payload?.['vote_average'] || 0);
    const parts: string[] = [item.mediaType === 'tv' ? 'TV Series' : 'Movie'];
    if (year) parts.push(year);

    return {
      item,
      metaLine: item.subtitle || parts.join(' • '),
      ratingValue: rating,
      yearValue: rawDate
    };
  }
}
