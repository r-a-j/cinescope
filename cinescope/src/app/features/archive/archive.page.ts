import { Component, ChangeDetectionStrategy, inject, signal, computed, ViewChild, AfterViewInit } from '@angular/core';
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
import { bookmarkOutline, checkmarkDoneCircleOutline, heart, heartOutline, trophyOutline } from 'ionicons/icons';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

const INITIAL_CHUNK_SIZE = 40;
const SCROLL_CHUNK_STEP = 40;

export interface ArchiveCardVm {
  id: string;
  doc: ContentDocType;
  title: string;
  posterUrl: string;
  metaSubtitle: string;
}

export interface FavoritePersonCardVm {
  id: number;
  docId: string;
  name: string;
  department: string;
  profileUrl: string;
  watched: number;
  total: number;
  percent: number;
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
        <ion-segment-button value="people">
          <ion-label>PEOPLE ({{ storage.favoritePeople().length }})</ion-label>
        </ion-segment-button>
      </ion-segment>
    </ion-toolbar>

    @if (activeTab() !== 'people' && activeTabItems().length > 0) {
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
              [class.fade-phase-a]="fadePhase() === 'a'"
              [class.fade-phase-b]="fadePhase() === 'b'">
              @for (vm of visibleWatchlist(); track vm.id; let idx = $index) {
                <div class="archive-card" [style.--enter-delay]="(idx < 12 ? idx * 16 : 0) + 'ms'">
                  <app-poster-card
                    [title]="vm.title"
                    [imageUrl]="vm.posterUrl"
                    [priority]="idx < 12"
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
              [class.fade-phase-a]="fadePhase() === 'a'"
              [class.fade-phase-b]="fadePhase() === 'b'">
              @for (vm of visibleWatched(); track vm.id; let idx = $index) {
                <div class="archive-card" [style.--enter-delay]="(idx < 12 ? idx * 16 : 0) + 'ms'">
                  <app-poster-card
                    [title]="vm.title"
                    [imageUrl]="vm.posterUrl"
                    [priority]="idx < 12"
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

        <!-- Keep-Alive Favorite People Pane -->
        <div class="archive-pane" [class.pane-hidden]="activeTab() !== 'people'">
          @if (favoritePeopleCards().length === 0) {
            <div class="empty-archive">
              <ion-icon name="heart-outline"></ion-icon>
              <h2>NO FAVORITE ARTISTS YET</h2>
              <p>Explore actors and directors on CineScope, tap the heart icon on their profile, and track your filmography progress here.</p>
            </div>
          } @else {
            <div
              class="people-grid"
              [class.fade-phase-a]="fadePhase() === 'a'"
              [class.fade-phase-b]="fadePhase() === 'b'">
              @for (person of favoritePeopleCards(); track person.id; let idx = $index) {
                <div
                  class="person-card"
                  [style.--enter-delay]="(idx < 12 ? idx * 16 : 0) + 'ms'"
                  (click)="onOpenPersonDetail(person)"
                  tabindex="0"
                  role="button"
                  (keyup.enter)="onOpenPersonDetail(person)">
                  <div class="person-card-avatar-wrap">
                    <img
                      [src]="person.profileUrl"
                      [alt]="person.name"
                      class="person-avatar"
                      loading="lazy" />
                  </div>

                  <div class="person-card-info">
                    <span class="person-card-name">{{ person.name }}</span>
                    <span class="person-card-dept">{{ person.department }}</span>

                    <div class="person-progress-block">
                      <div class="person-progress-bar">
                        <div class="person-progress-fill" [style.width.%]="person.percent"></div>
                      </div>
                      <div class="person-progress-meta">
                        <span class="progress-counts">{{ person.watched }}/{{ person.total }} watched</span>
                        <span class="progress-pct">{{ person.percent }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      @if (hasMoreItems()) {
        <ion-infinite-scroll threshold="750px" (ionInfinite)="onLoadMore($event)">
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
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px 7px;
      padding: 12px 10px 28px;
    }
    @media (min-width: 640px) {
      .archive-grid {
        grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
        gap: 16px 12px;
        padding: 16px 16px 36px;
      }
    }
    .archive-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      min-width: 0;
      content-visibility: auto;
      contain-intrinsic-size: 80px 160px;
    }
    .archive-grid.fade-phase-a .archive-card,
    .people-grid.fade-phase-a .person-card {
      animation: magicFadeIn 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: var(--enter-delay, 0ms);
    }
    .archive-grid.fade-phase-b .archive-card,
    .people-grid.fade-phase-b .person-card {
      animation: magicFadeIn 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: var(--enter-delay, 0ms);
    }
    @keyframes magicFadeIn {
      0% {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    .archive-card ::ng-deep .poster-container {
      width: 100%;
      height: auto;
      aspect-ratio: 2 / 3;
      border-radius: 6px;
      transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .archive-card:active ::ng-deep .poster-container {
      transform: scale(0.95);
    }
    .archive-card ::ng-deep .bookmark-btn {
      width: 26px;
      height: 26px;
      top: 5px;
      right: 5px;
      background: rgba(12, 12, 16, 0.78);
      backdrop-filter: blur(8px);

      .custom-icon {
        width: 8px;
      }
    }
    .archive-card-title {
      margin-top: 5px;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.25;
      color: rgba(255, 255, 255, 0.88);
      text-align: center;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 1px;
    }
    .archive-card-meta {
      margin-top: 1.5px;
      font-size: 9.5px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.45);
      text-align: center;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 1px;
    }
    .people-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
      gap: 12px 10px;
      padding: 14px 12px 28px;
    }
    .person-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 8px 10px;
      cursor: pointer;
      content-visibility: auto;
      contain-intrinsic-size: 140px 170px;
      transition: background 0.2s ease, transform 0.15s ease, border-color 0.2s ease;
    }
    .person-card:active {
      transform: scale(0.97);
      background: rgba(255, 255, 255, 0.07);
    }
    .person-card-avatar-wrap {
      position: relative;
      width: 80px;
      height: 80px;
      margin-bottom: 10px;
    }
    .person-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.18);
      background: #18181b;
      display: block;
    }
    .person-card-info {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .person-card-name {
      font-size: 13.5px;
      font-weight: 600;
      color: #ffffff;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .person-card-dept {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 2px;
      margin-bottom: 8px;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .person-progress-block {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .person-progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      overflow: hidden;
    }
    .person-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #e50914, #ff3b5c);
      border-radius: 999px;
      transition: width 0.3s ease;
    }
    .person-progress-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: rgba(255, 255, 255, 0.6);
    }
    .progress-counts {
      font-variant-numeric: tabular-nums;
    }
    .progress-pct {
      font-weight: 600;
      color: #ff3b5c;
      font-variant-numeric: tabular-nums;
    }
  `]
})
export class ArchivePage implements AfterViewInit {
  @ViewChild(IonContent, { static: false }) private content?: IonContent;
  private scrollEl: HTMLElement | null = null;
  private scrollPositions: Record<'watchlist' | 'watched' | 'people', number> = {
    watchlist: 0,
    watched: 0,
    people: 0
  };

  public storage = inject(StorageService);
  private toast = inject(ToastService);
  private router = inject(Router);

  public activeTab = signal<'watchlist' | 'watched' | 'people'>('watchlist');
  public mediaFilter = signal<'all' | 'movie' | 'tv'>('all');
  public fadePhase = signal<'a' | 'b'>('a');

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

  public favoritePeopleCards = computed<FavoritePersonCardVm[]>(() => {
    const docs = this.storage.favoritePeople();
    return docs.map((doc) => {
      const payload = (doc.payload ?? {}) as Record<string, unknown>;
      const name = String(payload['name'] || `Artist #${doc.tmdbId}`);
      const rawPath = (payload['profile_path'] || payload['posterUrl']) as string | undefined;
      const profileUrl = resolveMediaImageUrl(rawPath, 'w342');
      const department = String(payload['known_for_department'] || 'Artist');
      const creditIds = Array.isArray(payload['credit_ids']) ? (payload['credit_ids'] as string[]) : [];

      const progress = this.storage.getPersonProgress(creditIds);
      return {
        id: doc.tmdbId,
        docId: doc.id,
        name,
        department,
        profileUrl,
        watched: progress.watched,
        total: progress.total,
        percent: progress.percent
      };
    });
  });

  public hasMoreItems = computed<boolean>(() => {
    if (this.activeTab() === 'people') return false;
    return this.activeTab() === 'watchlist'
      ? this.visibleWatchlist().length < this.filteredWatchlist().length
      : this.visibleWatched().length < this.filteredWatched().length;
  });

  constructor() {
    addIcons({ bookmarkOutline, checkmarkDoneCircleOutline, heart, heartOutline, trophyOutline });
  }

  public ionViewWillEnter(): void {
    this.triggerFadeAnimation();
  }

  public async ngAfterViewInit(): Promise<void> {
    this.scrollEl = await this.content?.getScrollElement() ?? null;
  }

  public async onTabChange(event: Event): Promise<void> {
    const val = (event as CustomEvent).detail?.value as 'watchlist' | 'watched' | 'people' | undefined;
    if (val === 'watchlist' || val === 'watched' || val === 'people') {
      if (val === this.activeTab()) return;

      const prev = this.activeTab();
      if (!this.scrollEl && this.content) {
        this.scrollEl = await this.content.getScrollElement();
      }
      if (this.scrollEl) {
        this.scrollPositions[prev] = this.scrollEl.scrollTop;
      }

      this.activeTab.set(val);
      this.triggerFadeAnimation();

      const targetY = this.scrollPositions[val] || 0;
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
    }
  }

  public setMediaFilter(filter: 'all' | 'movie' | 'tv'): void {
    if (this.mediaFilter() !== filter) {
      this.mediaFilter.set(filter);
      this.triggerFadeAnimation();
      this.scrollPositions[this.activeTab()] = 0;
      if (this.scrollEl) {
        this.scrollEl.scrollTop = 0;
      } else {
        void this.content?.scrollToTop(0);
      }
    }
  }

  private triggerFadeAnimation(): void {
    this.fadePhase.update((current) => (current === 'a' ? 'b' : 'a'));
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

  public onOpenPersonDetail(person: FavoritePersonCardVm): void {
    void this.router.navigate(['/person', person.id], {
      state: {
        preview: {
          id: person.id,
          name: person.name,
          profileUrl: person.profileUrl,
          knownFor: person.department
        }
      }
    });
  }
}
