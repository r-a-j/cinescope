import { Component, ChangeDetectionStrategy, OnInit, AfterViewInit, inject, signal, computed, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, star } from 'ionicons/icons';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
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
  template: `
    <ion-content [fullscreen]="true" [scrollEvents]="true" (ionScroll)="onScroll()" class="collection-content">
      <div class="collection-shell">
        <!-- Top Navigation Header with Back Button -->
        <header class="collection-topbar">
          <button type="button" class="back-btn" aria-label="Go Back" (click)="goBack()">
            <ion-icon name="arrow-back-outline"></ion-icon>
            <span>Back</span>
          </button>

          <div class="topbar-titles">
            <span class="topbar-kicker">COLLECTION • {{ hasActiveFilters() ? displayedCards().length + ' OF ' + rawItems().length : rawItems().length }} TITLES</span>
            <h1 class="topbar-heading">{{ collectionTitle() }}</h1>
          </div>
        </header>

        <!-- Controls: Primary Sort Row + Multi-Select Filter Row -->
        @if (rawItems().length > 1 && !isPersonCollection()) {
          <div class="collection-controls">
            <!-- Row 1: Primary Sort Order -->
            <div class="control-row">
              <span class="control-label">SORT</span>
              <div class="chips-track">
                <button
                  type="button"
                  class="control-chip sort-chip"
                  [class.active]="sortMode() === 'featured'"
                  (click)="setSortMode('featured')">
                  Featured
                </button>
                <button
                  type="button"
                  class="control-chip sort-chip"
                  [class.active]="sortMode() === 'rating'"
                  (click)="setSortMode('rating')">
                  ★ Top Rated
                </button>
                <button
                  type="button"
                  class="control-chip sort-chip"
                  [class.active]="sortMode() === 'newest'"
                  (click)="setSortMode('newest')">
                  Newest
                </button>
                <button
                  type="button"
                  class="control-chip sort-chip"
                  [class.active]="sortMode() === 'alpha'"
                  (click)="setSortMode('alpha')">
                  A–Z
                </button>
              </div>
            </div>

            <!-- Row 2: Multi-Select Filter Chips -->
            <div class="control-row">
              <span class="control-label">FILTER</span>
              <div class="chips-track">
                @if (hasActiveFilters()) {
                  <button
                    type="button"
                    class="control-chip reset-chip"
                    (click)="resetFilters()">
                    Reset ✕
                  </button>
                }
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().minRating !== null"
                  (click)="toggleRatingFilter()">
                  ★ 7.0+
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().recentOnly"
                  (click)="toggleRecentFilter()">
                  📅 Recent
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().highVotesOnly"
                  (click)="toggleHighVotesFilter()">
                  🔥 100+ Votes
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().genres.includes('action')"
                  (click)="toggleGenreFilter('action')">
                  Action
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().genres.includes('comedy')"
                  (click)="toggleGenreFilter('comedy')">
                  Comedy
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().genres.includes('drama')"
                  (click)="toggleGenreFilter('drama')">
                  Drama
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().genres.includes('thriller')"
                  (click)="toggleGenreFilter('thriller')">
                  Thriller
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().genres.includes('scifi')"
                  (click)="toggleGenreFilter('scifi')">
                  Sci-Fi
                </button>
                <button
                  type="button"
                  class="control-chip filter-chip"
                  [class.active]="filters().genres.includes('romance')"
                  (click)="toggleGenreFilter('romance')">
                  Romance
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Poster Grid -->
        @if (displayedCards().length > 0) {
          <div class="collection-grid">
            @for (card of displayedCards(); track card.item.id; let idx = $index) {
              <div class="collection-card" [style.--card-delay]="(idx < 18 ? idx * 16 : 0) + 'ms'">
                <div class="poster-wrap">
                  <app-poster-card
                    [title]="card.item.title"
                    [imageUrl]="card.item.posterUrl || 'assets/placeholders/placeholder.webp'"
                    [priority]="idx < 12"
                    [showBookmark]="card.item.mediaType !== 'person'"
                    [bookmarkState]="getBookmarkState(card.item)"
                    (cardClick)="onCardClick(card.item)"
                    (bookmarkToggle)="onToggleBookmark(card.item)">
                  </app-poster-card>
                  @if (card.ratingValue > 0) {
                    <div class="rating-pill">
                      <ion-icon name="star"></ion-icon>
                      {{ card.ratingValue.toFixed(1) }}
                    </div>
                  }
                </div>

                <div
                  class="card-info"
                  tabindex="0"
                  (click)="onCardClick(card.item)"
                  (keyup.enter)="onCardClick(card.item)">
                  <div class="card-title">{{ card.item.title }}</div>
                  @if (card.metaLine) {
                    <div class="card-meta">{{ card.metaLine }}</div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Infinite Scroll with 500px Preloading Threshold -->
          <ion-infinite-scroll
            threshold="500px"
            [disabled]="!hasMore()"
            (ionInfinite)="loadMore($event)">
            <ion-infinite-scroll-content
              loadingSpinner="crescent"
              loadingText="Loading more titles...">
            </ion-infinite-scroll-content>
          </ion-infinite-scroll>
        } @else {
          <div class="empty-collection">
            @if (hasActiveFilters()) {
              <p>No titles match the selected filters.</p>
              <button type="button" class="empty-back-btn" (click)="resetFilters()">Clear Filters</button>
            } @else {
              <p>No items in this collection.</p>
              <button type="button" class="empty-back-btn" (click)="goBack()">Go Back</button>
            }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .collection-content {
      --background: #09090d;
      color: #ffffff;
    }
    .collection-shell {
      min-height: 100%;
      padding-bottom: calc(env(safe-area-inset-bottom, 20px) + 32px);
    }
    .collection-topbar {
      position: sticky;
      top: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: calc(env(safe-area-inset-top, 16px) + 12px) 16px 14px;
      background: rgba(9, 9, 13, 0.92);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 38px;
      padding: 0 14px 0 10px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.07);
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.12s ease, background 0.15s ease;
    }
    .back-btn:active {
      transform: scale(0.95);
      background: rgba(229, 9, 20, 0.25);
    }
    .back-btn ion-icon {
      font-size: 18px;
    }
    .topbar-titles {
      min-width: 0;
      flex: 1;
    }
    .topbar-kicker {
      display: block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.4px;
      color: var(--ion-color-primary);
      text-transform: uppercase;
    }
    .topbar-heading {
      margin: 2px 0 0;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.4px;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: uppercase;
    }
    .collection-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 16px;
      background: #0b0b10;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .control-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .control-label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.45);
      flex-shrink: 0;
      width: 48px;
    }
    .chips-track {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      flex: 1;
    }
    .chips-track::-webkit-scrollbar {
      display: none;
    }
    .control-chip {
      flex: 0 0 auto;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
    }
    .control-chip:active {
      transform: scale(0.96);
    }
    .control-chip.active {
      background: var(--ion-color-primary, #e50914);
      border-color: var(--ion-color-primary, #e50914);
      color: #ffffff;
      font-weight: 700;
    }
    .reset-chip {
      background: rgba(229, 9, 20, 0.15);
      border-color: rgba(229, 9, 20, 0.45);
      color: #ff6b6b;
      font-weight: 700;
    }
    .collection-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px 12px;
      padding: 16px;
    }
    .collection-card {
      display: flex;
      flex-direction: column;
      min-width: 0;
      animation: cardRiseIn 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--card-delay, 0ms);
    }
    @keyframes cardRiseIn {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    .poster-wrap {
      position: relative;
      width: 100%;
    }
    .rating-pill {
      position: absolute;
      bottom: 8px;
      left: 8px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(10, 10, 14, 0.85);
      border: 1px solid rgba(251, 191, 36, 0.35);
      color: #fbbf24;
      font-size: 10.5px;
      font-weight: 800;
      pointer-events: none;
    }
    .rating-pill ion-icon {
      font-size: 10px;
    }
    .card-info {
      margin-top: 7px;
      padding: 0 2px;
      cursor: pointer;
    }
    .card-title {
      font-size: 12.5px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.92);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-meta {
      margin-top: 2px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.52);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .empty-collection {
      padding: 64px 24px;
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
    }
    .empty-back-btn {
      margin-top: 12px;
      padding: 8px 18px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      font-weight: 700;
      cursor: pointer;
    }
    ion-infinite-scroll {
      margin-top: 12px;
      margin-bottom: 24px;
    }
    ion-infinite-scroll-content {
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      font-weight: 600;
    }
  `]
})
export class CollectionPage implements OnInit, AfterViewInit {
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
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
    addIcons({ arrowBackOutline, star });
  }

  ngOnInit(): void {
    const navState = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as {
      title?: string;
      items?: SwimlaneItem[];
      queryContext?: CollectionQueryContext;
    } | undefined;

    if (navState?.title) {
      this.collectionTitle.set(navState.title);
    }
    if (navState?.queryContext) {
      this.queryContext.set(navState.queryContext);
    }
    if (Array.isArray(navState?.items)) {
      this.rawItems.set(navState.items);
      // Small or finite collections without queryContext don't need infinite scrolling
      if (navState.items.length < 15 && !navState.queryContext) {
        this.hasMore.set(false);
      }
    }
  }

  ngAfterViewInit(): void {
    // If initial items don't fill viewport enough to scroll comfortably, preload next page
    setTimeout(() => {
      void this.checkAndPreloadNext();
    }, 250);
  }

  public goBack(): void {
    this.navCtrl.back();
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
        const existingIds = new Set(this.rawItems().map((i) => i.id));
        const unique = res.items.filter((i) => !existingIds.has(i.id));
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
