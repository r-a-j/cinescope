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
  templateUrl: './archive.page.html',
  styleUrls: ['./archive.page.scss']
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
  public watchlistMediaFilter = signal<'all' | 'movie' | 'tv'>('all');
  public watchedMediaFilter = signal<'all' | 'movie' | 'tv'>('all');

  public currentMediaFilter = computed<'all' | 'movie' | 'tv'>(() => {
    return this.activeTab() === 'watchlist'
      ? this.watchlistMediaFilter()
      : this.watchedMediaFilter();
  });
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
    const filter = this.watchlistMediaFilter();
    const filtered = filter === 'all' ? items : items.filter((item) => item.mediaType === filter);
    return filtered.map((doc) => this.toCardVm(doc));
  });

  public filteredWatched = computed<ArchiveCardVm[]>(() => {
    const items = this.storage.watchedItems();
    const filter = this.watchedMediaFilter();
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
    const tab = this.activeTab();
    if (tab === 'watchlist') {
      if (this.watchlistMediaFilter() !== filter) {
        this.watchlistMediaFilter.set(filter);
        this.visibleWatchlistLimit.set(INITIAL_CHUNK_SIZE);
        this.triggerFadeAnimation();
        this.scrollPositions['watchlist'] = 0;
        if (this.scrollEl) {
          this.scrollEl.scrollTop = 0;
        } else {
          void this.content?.scrollToTop(0);
        }
      }
    } else if (tab === 'watched') {
      if (this.watchedMediaFilter() !== filter) {
        this.watchedMediaFilter.set(filter);
        this.visibleWatchedLimit.set(INITIAL_CHUNK_SIZE);
        this.triggerFadeAnimation();
        this.scrollPositions['watched'] = 0;
        if (this.scrollEl) {
          this.scrollEl.scrollTop = 0;
        } else {
          void this.content?.scrollToTop(0);
        }
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
