import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, star } from 'ionicons/icons';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

export type CollectionSortMode = 'featured' | 'rating' | 'newest' | 'alpha';

interface CollectionCardVm {
  item: SwimlaneItem;
  metaLine: string;
  ratingValue: number;
  yearValue: string;
}

@Component({
  selector: 'app-collection-page',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, PosterCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true" class="collection-content">
      <div class="collection-shell">
        <!-- Top Navigation Header with Back Button -->
        <header class="collection-topbar">
          <button type="button" class="back-btn" aria-label="Go Back" (click)="goBack()">
            <ion-icon name="arrow-back-outline"></ion-icon>
            <span>Back</span>
          </button>

          <div class="topbar-titles">
            <span class="topbar-kicker">COLLECTION • {{ rawItems().length }} TITLES</span>
            <h1 class="topbar-heading">{{ collectionTitle() }}</h1>
          </div>
        </header>

        <!-- Sort Filter Bar (shown for Movie/TV collections) -->
        @if (rawItems().length > 1 && !isPersonCollection()) {
          <div class="sort-bar">
            <button
              type="button"
              class="sort-chip"
              [class.active]="sortMode() === 'featured'"
              (click)="setSortMode('featured')">
              Featured
            </button>
            <button
              type="button"
              class="sort-chip"
              [class.active]="sortMode() === 'rating'"
              (click)="setSortMode('rating')">
              ★ Top Rated
            </button>
            <button
              type="button"
              class="sort-chip"
              [class.active]="sortMode() === 'newest'"
              (click)="setSortMode('newest')">
              Newest
            </button>
            <button
              type="button"
              class="sort-chip"
              [class.active]="sortMode() === 'alpha'"
              (click)="setSortMode('alpha')">
              A–Z
            </button>
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
        } @else {
          <div class="empty-collection">
            <p>No items in this collection.</p>
            <button type="button" class="empty-back-btn" (click)="goBack()">Go Back</button>
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
    .sort-bar {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      overflow-x: auto;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: #0b0b10;
      scrollbar-width: none;
    }
    .sort-bar::-webkit-scrollbar {
      display: none;
    }
    .sort-chip {
      flex: 0 0 auto;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.72);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .sort-chip.active {
      background: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
      color: #ffffff;
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
  `]
})
export class CollectionPage implements OnInit {
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);

  public collectionTitle = signal<string>('Collection');
  public rawItems = signal<SwimlaneItem[]>([]);
  public sortMode = signal<CollectionSortMode>('featured');

  public isPersonCollection = computed<boolean>(() => {
    const list = this.rawItems();
    return list.length > 0 && list[0].mediaType === 'person';
  });

  public displayedCards = computed<CollectionCardVm[]>(() => {
    const mode = this.sortMode();
    const mapped = this.rawItems().map((item) => this.toCardVm(item));

    if (mode === 'rating') {
      return [...mapped].sort((a, b) => b.ratingValue - a.ratingValue);
    }
    if (mode === 'newest') {
      return [...mapped].sort((a, b) => b.yearValue.localeCompare(a.yearValue));
    }
    if (mode === 'alpha') {
      return [...mapped].sort((a, b) => a.item.title.localeCompare(b.item.title));
    }
    return mapped;
  });

  constructor() {
    addIcons({ arrowBackOutline, star });
  }

  ngOnInit(): void {
    const navState = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as {
      title?: string;
      items?: SwimlaneItem[];
    } | undefined;

    if (navState?.title) {
      this.collectionTitle.set(navState.title);
    }
    if (Array.isArray(navState?.items)) {
      this.rawItems.set(navState.items);
    }
  }

  public goBack(): void {
    this.navCtrl.back();
  }

  public setSortMode(mode: CollectionSortMode): void {
    this.sortMode.set(mode);
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
