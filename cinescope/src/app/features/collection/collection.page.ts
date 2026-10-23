import { Component, ChangeDetectionStrategy, OnInit, AfterViewInit, inject, signal, computed, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, homeOutline, star } from 'ionicons/icons';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { NavigationService } from '../../core/services/navigation.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';
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
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(IonContent, { static: false }) private content?: IonContent;
  @ViewChild(IonInfiniteScroll, { static: false }) private infiniteScroll?: IonInfiniteScroll;

  public collectionTitle = signal<string>('Collection');
  public rawItems = signal<SwimlaneItem[]>([]);
  public sortMode = signal<CollectionSortMode>('featured');
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
    const f = this.filters();
    return f.minRating !== null || f.recentOnly || f.highVotesOnly || f.genres.length > 0;
  });

  public isPersonCollection = computed<boolean>(() => {
    const list = this.rawItems();
    return list.length > 0 && list[0].mediaType === 'person';
  });

  public displayedCards = computed<CollectionCardVm[]>(() => {
    const mode = this.sortMode();
    const f = this.filters();
    let vms = this.rawItems().map((item) => this.toCardVm(item));

    // Multi-Select Filter Criteria Pipeline
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

    // Primary Ordering
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
    addIcons({ arrowBackOutline, star, homeOutline });
  }

  ngOnInit(): void {
    this.extractNavigationState();
  }

  public ionViewWillEnter(): void {
    this.extractNavigationState();
  }

  private extractNavigationState(): void {
    const navState = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as {
      title?: string;
      items?: SwimlaneItem[];
      queryContext?: CollectionQueryContext;
    } | undefined;

    const qParams = this.route.snapshot.queryParams;

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
      // Small or finite collections without queryContext don't need infinite scrolling
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
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load initial collection items:', err);
    } finally {
      this.isFetchingMore = false;
      this.isLoadingMore.set(false);
    }
  }

  ngAfterViewInit(): void {
    // If initial items don't fill viewport enough to scroll comfortably, preload next page
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
    // Proactively fetch next page when user is within 500px of bottom
    if (distanceFromBottom <= 500) {
      void this.loadMore();
    }
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

    // Smoothly scroll to top so the user views the newly sorted items from the beginning
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
      // For algorithmic feeds without API-level sort (Trending, Now Playing, Recommendations):
      // Pre-fetch pages 2 and 3 into the buffer so the user gets a rich, sorted batch
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

        // If this page had only duplicate items but TMDB has more pages, keep going to the next page!
        if (unique.length === 0 && res.hasMore) {
          this.isFetchingMore = false;
          this.isLoadingMore.set(false);
          void this.loadMore();
          return;
        }
      }

      const canContinue = res.hasMore && res.items.length > 0;
      this.hasMore.set(canContinue);

      // Force immediate DOM update so ion-content's scrollHeight expands before completing
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load more collection items:', err);
      this.hasMore.set(false);
    } finally {
      this.isFetchingMore = false;
      this.isLoadingMore.set(false);
      await infiniteTarget?.complete?.();

      // If user is already near the bottom of the newly rendered content, keep preloading!
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
