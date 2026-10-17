import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bookmarkOutline, checkmarkDoneCircleOutline } from 'ionicons/icons';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

const INITIAL_CHUNK_SIZE = 30;
const SCROLL_CHUNK_STEP = 36;

interface ArchiveCardVm {
  id: string;
  doc: ContentDocType;
  title: string;
  posterUrl: string;
  metaSubtitle: string;
}

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonToolbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    HeaderComponent,
    PosterCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header></app-header>

    <ion-toolbar class="archive-toolbar">
      <ion-segment [value]="activeTab()" (ionChange)="onTabChange($event)">
        <ion-segment-button value="watchlist">
          <ion-label>WATCHLIST ({{ storage.watchlistItems().length }})</ion-label>
        </ion-segment-button>
        <ion-segment-button value="watched">
          <ion-label>WATCHED ({{ storage.watchedItems().length }})</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-toolbar>

    @if (activeTabItems().length > 0) {
      <div class="filter-bar">
        <button
          type="button"
          class="filter-chip"
          [class.active]="mediaFilter() === 'all'"
          (click)="setMediaFilter('all')">
          All ({{ activeTabItems().length }})
        </button>
        <button
          type="button"
          class="filter-chip"
          [class.active]="mediaFilter() === 'movie'"
          (click)="setMediaFilter('movie')">
          Movies ({{ movieCount() }})
        </button>
        <button
          type="button"
          class="filter-chip"
          [class.active]="mediaFilter() === 'tv'"
          (click)="setMediaFilter('tv')">
          TV Shows ({{ tvCount() }})
        </button>
      </div>
    }

    <ion-content color="background">
      <div class="archive-panes-wrapper">
        <!-- Keep-Alive Watchlist Pane (uses visibility/opacity instead of display:none so Chromium never evicts decoded GPU textures) -->
        <div class="archive-pane" [class.pane-hidden]="activeTab() !== 'watchlist'">
          @if (filteredWatchlist().length === 0) {
            <div class="empty-archive">
              <ion-icon name="bookmark-outline"></ion-icon>
              <h2>YOUR WATCHLIST IS EMPTY</h2>
              <p>Tap the bookmark icon on any movie or TV show in Discover or Search, or restore a backup in Settings.</p>
            </div>
          } @else {
            <div
              class="archive-grid"
              [class.flip-phase-a]="flipPhase() === 'a'"
              [class.flip-phase-b]="flipPhase() === 'b'">
              @for (vm of visibleWatchlist(); track vm.id; let idx = $index) {
                <div class="archive-card" [style.--flip-delay]="(idx < 15 ? idx * 14 : 0) + 'ms'">
                  <app-poster-card
                    [title]="vm.title"
                    [imageUrl]="vm.posterUrl"
                    [priority]="idx < 18"
                    [showBookmark]="true"
                    bookmarkState="watchlist"
                    (cardClick)="onOpenDetail(vm)"
                    (bookmarkToggle)="onToggleBookmark(vm.doc)">
                  </app-poster-card>
                  <div class="archive-card-title">{{ vm.title }}</div>
                  <div class="archive-card-meta">{{ vm.metaSubtitle }}</div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Keep-Alive Watched Pane -->
        <div class="archive-pane" [class.pane-hidden]="activeTab() !== 'watched'">
          @if (filteredWatched().length === 0) {
            <div class="empty-archive">
              <ion-icon name="checkmark-done-circle-outline"></ion-icon>
              <h2>NO WATCHED TITLES YET</h2>
              <p>Tap the bookmark icon on any movie or TV show in Discover or Search, or restore a backup in Settings.</p>
            </div>
          } @else {
            <div
              class="archive-grid"
              [class.flip-phase-a]="flipPhase() === 'a'"
              [class.flip-phase-b]="flipPhase() === 'b'">
              @for (vm of visibleWatched(); track vm.id; let idx = $index) {
                <div class="archive-card" [style.--flip-delay]="(idx < 15 ? idx * 14 : 0) + 'ms'">
                  <app-poster-card
                    [title]="vm.title"
                    [imageUrl]="vm.posterUrl"
                    [priority]="idx < 18"
                    [showBookmark]="true"
                    bookmarkState="watched"
                    (cardClick)="onOpenDetail(vm)"
                    (bookmarkToggle)="onToggleBookmark(vm.doc)">
                  </app-poster-card>
                  <div class="archive-card-title">{{ vm.title }}</div>
                  <div class="archive-card-meta">{{ vm.metaSubtitle }}</div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      @if (hasMoreItems()) {
        <ion-infinite-scroll threshold="300px" (ionInfinite)="onLoadMore($event)">
          <ion-infinite-scroll-content loadingSpinner="crescent"></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      }
    </ion-content>
  `,
  styles: [`
    .archive-toolbar {
      --background: #000000;
      --border-width: 0 0 1px 0;
      --border-color: rgba(255, 255, 255, 0.08);
    }
    ion-segment-button {
      --color: rgba(255, 255, 255, 0.5);
      --color-checked: #ffffff;
      --indicator-color: var(--ion-color-primary);
      font-size: 16px;
      letter-spacing: 1px;
    }
    .filter-bar {
      display: flex;
      gap: 8px;
      padding: 10px 16px;
      background: #000000;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      overflow-x: auto;
    }
    .filter-chip {
      background: rgba(255, 255, 255, 0.07);
      color: rgba(255, 255, 255, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .filter-chip.active {
      background: var(--ion-color-primary);
      color: #ffffff;
      border-color: var(--ion-color-primary);
    }
    .archive-panes-wrapper {
      position: relative;
      width: 100%;
    }
    .archive-pane {
      width: 100%;
    }
    .archive-pane.pane-hidden {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 0;
      overflow: hidden;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    }
    .empty-archive {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      padding: 0 32px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
    }
    .empty-archive ion-icon {
      font-size: 64px;
      margin-bottom: 16px;
      color: rgba(255, 255, 255, 0.25);
    }
    .empty-archive h2 {
      color: #ffffff;
      font-size: 24px;
      margin: 0 0 8px;
    }
    .empty-archive p {
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
    }
    .archive-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
      gap: 18px 12px;
      padding: 16px;
      perspective: 900px;
    }
    .archive-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      transform-style: preserve-3d;
      backface-visibility: hidden;
      will-change: transform, opacity;
    }
    .archive-grid.flip-phase-a .archive-card {
      animation: archiveCardFlipA 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--flip-delay, 0ms);
    }
    .archive-grid.flip-phase-b .archive-card {
      animation: archiveCardFlipB 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--flip-delay, 0ms);
    }
    @keyframes archiveCardFlipA {
      0% {
        opacity: 0.4;
        transform: rotateY(-26deg) translateY(5px) scale(0.95);
      }
      65% {
        opacity: 1;
        transform: rotateY(4deg) translateY(-1px) scale(1.01);
      }
      100% {
        opacity: 1;
        transform: rotateY(0deg) translateY(0) scale(1);
      }
    }
    @keyframes archiveCardFlipB {
      0% {
        opacity: 0.4;
        transform: rotateY(-26deg) translateY(5px) scale(0.95);
      }
      65% {
        opacity: 1;
        transform: rotateY(4deg) translateY(-1px) scale(1.01);
      }
      100% {
        opacity: 1;
        transform: rotateY(0deg) translateY(0) scale(1);
      }
    }
    .archive-card ::ng-deep .poster-container {
      width: 100%;
      height: auto;
      aspect-ratio: 2 / 3;
      transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .archive-card:active ::ng-deep .poster-container {
      transform: scale(0.95) rotateY(8deg);
    }
    .archive-card-title {
      margin-top: 6px;
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.88);
      text-align: center;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .archive-card-meta {
      margin-top: 2px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class ArchivePage {
  public storage = inject(StorageService);
  private toast = inject(ToastService);
  private router = inject(Router);

  public activeTab = signal<'watchlist' | 'watched'>('watchlist');
  public mediaFilter = signal<'all' | 'movie' | 'tv'>('all');
  public flipPhase = signal<'a' | 'b'>('a');

  public visibleWatchlistLimit = signal<number>(INITIAL_CHUNK_SIZE);
  public visibleWatchedLimit = signal<number>(INITIAL_CHUNK_SIZE);

  public activeTabItems = computed<ContentDocType[]>(() => {
    return this.activeTab() === 'watchlist'
      ? this.storage.watchlistItems()
      : this.storage.watchedItems();
  });

  public movieCount = computed<number>(() => {
    return this.activeTabItems().filter((item) => item.mediaType === 'movie').length;
  });

  public tvCount = computed<number>(() => {
    return this.activeTabItems().filter((item) => item.mediaType === 'tv').length;
  });

  public filteredWatchlist = computed<ArchiveCardVm[]>(() => {
    const items = this.storage.watchlistItems();
    const filter = this.mediaFilter();
    const filtered = filter === 'all' ? items : items.filter((item) => item.mediaType === filter);
    return filtered.map((doc) => this.toCardVm(doc));
  });

  public filteredWatched = computed<ArchiveCardVm[]>(() => {
    const items = this.storage.watchedItems();
    const filter = this.mediaFilter();
    const filtered = filter === 'all' ? items : items.filter((item) => item.mediaType === filter);
    return filtered.map((doc) => this.toCardVm(doc));
  });

  public visibleWatchlist = computed<ArchiveCardVm[]>(() => {
    return this.filteredWatchlist().slice(0, this.visibleWatchlistLimit());
  });

  public visibleWatched = computed<ArchiveCardVm[]>(() => {
    return this.filteredWatched().slice(0, this.visibleWatchedLimit());
  });

  public hasMoreItems = computed<boolean>(() => {
    return this.activeTab() === 'watchlist'
      ? this.visibleWatchlist().length < this.filteredWatchlist().length
      : this.visibleWatched().length < this.filteredWatched().length;
  });

  constructor() {
    addIcons({ bookmarkOutline, checkmarkDoneCircleOutline });
  }

  public ionViewWillEnter(): void {
    this.triggerFlipAnimation();
  }

  public onTabChange(event: Event): void {
    const val = (event as CustomEvent).detail?.value;
    if (val === 'watchlist' || val === 'watched') {
      this.activeTab.set(val);
      this.triggerFlipAnimation();
    }
  }

  public setMediaFilter(filter: 'all' | 'movie' | 'tv'): void {
    if (this.mediaFilter() !== filter) {
      this.mediaFilter.set(filter);
      this.triggerFlipAnimation();
    }
  }

  private triggerFlipAnimation(): void {
    this.flipPhase.update((current) => (current === 'a' ? 'b' : 'a'));
  }

  public onLoadMore(event: Event): void {
    if (this.activeTab() === 'watchlist') {
      this.visibleWatchlistLimit.update((current) => current + SCROLL_CHUNK_STEP);
    } else {
      this.visibleWatchedLimit.update((current) => current + SCROLL_CHUNK_STEP);
    }
    const target = event.target as HTMLIonInfiniteScrollElement | null;
    if (target) {
      void target.complete();
    }
  }

  public onOpenDetail(vm: ArchiveCardVm): void {
    if (vm.doc.mediaType === 'person') return;
    void this.router.navigate(['/media', vm.doc.mediaType, vm.doc.tmdbId], {
      state: {
        preview: {
          id: vm.doc.tmdbId,
          mediaType: vm.doc.mediaType,
          title: vm.title,
          posterUrl: vm.posterUrl
        }
      }
    });
  }

  private toCardVm(doc: ContentDocType): ArchiveCardVm {
    const payload = doc.payload as Record<string, unknown> | undefined;
    const title = String(payload?.['title'] || payload?.['name'] || `#${doc.tmdbId}`);
    const rawPath = (payload?.['poster_path'] || payload?.['profile_path'] || payload?.['posterUrl']) as string | undefined;
    const posterUrl = resolveMediaImageUrl(rawPath, 'w342');

    const rawDate = String(payload?.['release_date'] || payload?.['first_air_date'] || '');
    const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : '';
    const rating = Number(payload?.['vote_average'] || 0);
    const parts: string[] = [doc.mediaType === 'tv' ? 'TV' : 'Movie'];
    if (year) parts.push(year);
    if (rating > 0) parts.push(`★ ${rating.toFixed(1)}`);

    return {
      id: doc.id,
      doc,
      title,
      posterUrl,
      metaSubtitle: parts.join(' • ')
    };
  }

  public getBookmarkState(doc: ContentDocType): BookmarkState {
    return doc.lists.includes('watched') ? 'watched' : 'watchlist';
  }

  public async onToggleBookmark(doc: ContentDocType): Promise<void> {
    if (doc.mediaType === 'person') return;
    const payload = doc.payload as Record<string, unknown> | undefined;
    const title = String(payload?.['title'] || payload?.['name'] || `#${doc.tmdbId}`);
    const nextState = await this.storage.cycleBookmark(
      doc.tmdbId,
      doc.mediaType,
      doc.payload as Record<string, unknown>
    );
    if (nextState === 'watched') {
      await this.toast.presentInfo(`Moved "${title}" to Watched`, 1800);
    } else if (nextState === 'none') {
      await this.toast.presentWarning(`Removed "${title}" from Archive`, 1800);
    }
  }
}
