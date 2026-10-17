import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bookmarkOutline, checkmarkDoneCircleOutline } from 'ionicons/icons';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

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

    <ion-content color="background">
      @if (displayedItems().length === 0) {
        <div class="empty-archive">
          <ion-icon [name]="activeTab() === 'watchlist' ? 'bookmark-outline' : 'checkmark-done-circle-outline'"></ion-icon>
          <h2>{{ activeTab() === 'watchlist' ? 'YOUR WATCHLIST IS EMPTY' : 'NO WATCHED TITLES YET' }}</h2>
          <p>Tap the bookmark icon on any movie or TV show in Discover or Search to save it here.</p>
        </div>
      } @else {
        <div class="archive-grid">
          @for (doc of displayedItems(); track doc.id) {
            <div class="archive-card">
              <app-poster-card
                [title]="getTitle(doc)"
                [imageUrl]="getPosterUrl(doc)"
                [showBookmark]="true"
                [bookmarkState]="getBookmarkState(doc)"
                (bookmarkToggle)="onToggleBookmark(doc)">
              </app-poster-card>
              <div class="archive-card-title">{{ getTitle(doc) }}</div>
            </div>
          }
        </div>
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
    }
    .archive-card {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .archive-card ::ng-deep .poster-container {
      width: 100%;
      height: auto;
      aspect-ratio: 2 / 3;
    }
    .archive-card-title {
      margin-top: 6px;
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.85);
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

  public activeTab = signal<'watchlist' | 'watched'>('watchlist');

  public displayedItems = computed<ContentDocType[]>(() => {
    return this.activeTab() === 'watchlist'
      ? this.storage.watchlistItems()
      : this.storage.watchedItems();
  });

  constructor() {
    addIcons({ bookmarkOutline, checkmarkDoneCircleOutline });
  }

  public onTabChange(event: Event): void {
    const val = (event as CustomEvent).detail?.value;
    if (val === 'watchlist' || val === 'watched') {
      this.activeTab.set(val);
    }
  }

  public getTitle(doc: ContentDocType): string {
    const payload = doc.payload as Record<string, unknown> | undefined;
    return String(payload?.['title'] || payload?.['name'] || `#${doc.tmdbId}`);
  }

  public getPosterUrl(doc: ContentDocType): string {
    const payload = doc.payload as Record<string, unknown> | undefined;
    const rawPath = (payload?.['posterUrl'] || payload?.['poster_path'] || payload?.['profile_path']) as string | undefined;
    return resolveMediaImageUrl(rawPath, 'w500');
  }

  public getBookmarkState(doc: ContentDocType): BookmarkState {
    return doc.lists.includes('watched') ? 'watched' : 'watchlist';
  }

  public async onToggleBookmark(doc: ContentDocType): Promise<void> {
    if (doc.mediaType === 'person') return;
    const title = this.getTitle(doc);
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
