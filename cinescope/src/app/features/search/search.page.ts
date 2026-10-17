import { Component, OnInit, ChangeDetectionStrategy, inject, ViewChild } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonSearchbar, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent,
  IonSpinner, IonButton, NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  timeOutline, closeCircle, searchOutline, filmOutline, tvOutline,
  personOutline, sparkles, sparklesOutline, alertCircle, bookmark, bookmarkOutline, checkmarkCircle
} from 'ionicons/icons';
import { SearchStore } from '../../core/store/search.store';
import { TmdbMultiSearchResultDto } from '../../core/services/tmdb-search.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { BookmarkState } from '../../shared/components/poster-card/poster-card.component';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonToolbar, IonSearchbar, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent,
    IonSpinner, IonButton, CommonModule, FormsModule
  ]
})
export class SearchPage implements OnInit {
  public store = inject(SearchStore);
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private navCtrl = inject(NavController);
  private router = inject(Router);

  @ViewChild(IonSearchbar) searchbar!: IonSearchbar;

  public trackById(index: number, item: { id: number }): number {
    return item.id;
  }
  public trackByString(index: number, item: string): string {
    return item;
  }

  constructor() {
    addIcons({
      timeOutline, closeCircle, searchOutline, filmOutline, tvOutline,
      personOutline, sparkles, sparklesOutline, alertCircle, bookmark, bookmarkOutline, checkmarkCircle
    });
  }

  ngOnInit(): void {
    this.store.loadRecentSearches();
  }

  public resolveImage(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w500');
  }

  public getBookmarkState(item: TmdbMultiSearchResultDto): BookmarkState {
    if (item.media_type === 'person') return 'none';
    return this.storageService.getBookmarkState(item.id, item.media_type);
  }

  public goBack(): void {
    this.navCtrl.back();
  }

  onSearchChange(event: Event | CustomEvent): void {
    const customEvent = event as CustomEvent;
    const query = customEvent.detail?.value;
    this.store.searchQuery(query || '');
  }

  clearSearch(): void {
    this.store.searchQuery('');
  }

  triggerSmartSearch(): void {
    if (!this.store.query().trim() || this.store.smartSearchRetryTimer() > 0) {
      return;
    }

    Keyboard.hide().catch(() => console.debug('[UI - Search Page] Keyboard native hide skipped'));

    if (this.searchbar) {
      this.searchbar.getInputElement().then((input: HTMLInputElement) => {
        input.blur();
      });
    }

    console.log('[UI - Search Page] Triggering Smart Search execution via Store');
    this.store.executeSmartSearch();
  }

  onSearchSubmit(): void {
    const query = this.store.query();
    if (query.trim()) {
      this.store.saveSearchToHistory(query);
    }
    Keyboard.hide().catch(() => console.debug('Keyboard native hide skipped'));

    if (this.searchbar) {
      this.searchbar.getInputElement().then((input: HTMLInputElement) => {
        input.blur();
      });
    }
  }

  onResultClick(item: TmdbMultiSearchResultDto): void {
    const query = this.store.query();
    if (query.trim()) {
      this.store.saveSearchToHistory(query);
    }
    if (item.media_type === 'movie' || item.media_type === 'tv') {
      const title = item.media_type === 'movie' ? item.title : item.name;
      const rawDate = item.media_type === 'movie' ? item.release_date : item.first_air_date;
      void this.router.navigate(['/media', item.media_type, item.id], {
        state: {
          preview: {
            id: item.id,
            mediaType: item.media_type,
            title,
            overview: item.overview,
            posterUrl: this.resolveImage(item.poster_path),
            backdropUrl: item.backdrop_path ? resolveMediaImageUrl(item.backdrop_path, 'w1280') : undefined,
            releaseYear: rawDate ? rawDate.slice(0, 4) : '',
            rating: item.vote_average ? item.vote_average.toFixed(1) : undefined
          }
        }
      });
    }
  }

  async onQuickBookmark(item: TmdbMultiSearchResultDto, event: Event): Promise<void> {
    event.stopPropagation();
    if (item.media_type === 'movie' || item.media_type === 'tv') {
      const title = item.media_type === 'movie' ? item.title : item.name;
      const payload = {
        ...item,
        title,
        posterUrl: this.resolveImage(item.poster_path)
      };
      const nextState = await this.storageService.cycleBookmark(item.id, item.media_type, payload);
      if (nextState === 'watchlist') {
        await this.toastService.presentSuccess(`Added "${title}" to Watchlist`, 1800);
      } else if (nextState === 'watched') {
        await this.toastService.presentInfo(`Marked "${title}" as Watched`, 1800);
      } else {
        await this.toastService.presentWarning(`Removed "${title}" from Archive`, 1800);
      }
    }
  }

  loadMore(event: Event | CustomEvent): void {
    const target = event.target as HTMLIonInfiniteScrollElement;
    if (this.store.hasMore() && !this.store.isLoading() && !this.store.isAppending()) {
      this.store.loadNextPage().then(() => {
        if (target) {
          target.complete();
        }
      });
    } else {
      if (target) {
        target.complete();
      }
    }
  }

  applyRecentSearch(query: string): void {
    this.store.searchQuery(query);
  }

  removeRecentSearch(query: string, event: Event): void {
    event.stopPropagation();
    this.store.removeRecentSearch(query);
  }

  clearHistory(): void {
    this.store.clearRecentSearches();
  }
}
