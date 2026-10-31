import { Component, OnInit, ChangeDetectionStrategy, inject, ViewChild, computed, signal } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonSearchbar, IonButtons, IonBackButton,
  IonIcon, IonInfiniteScroll, IonInfiniteScrollContent,
  IonSpinner, NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  timeOutline, closeCircle, closeOutline, searchOutline, filmOutline, tvOutline,
  personOutline, sparkles, sparklesOutline, alertCircle, bookmark, bookmarkOutline, checkmarkCircle,
  layersOutline, albumsOutline, chevronForwardOutline, ribbonOutline, arrowForwardOutline, trashOutline
} from 'ionicons/icons';
import { SearchStore, SearchFilter } from '../../core/store/search.store';
import { TmdbMultiSearchResultDto } from '../../core/services/tmdb-search.service';
import { DEFAULT_POSTER_PLACEHOLDER, resolveMediaImageUrl } from '../../core/constants/api.constants';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { FranchiseAggregatorService } from '../../core/services/franchise-aggregator.service';
import { PosterCacheService } from '../../core/services/poster-cache.service';
import { BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FranchiseCollectionSummary } from '../../core/models/franchise.model';
import { TmdbCollectionListItemDto } from '../../core/dtos/collections/collection-list-item.dto';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { AppTourService } from '../../core/services/app-tour.service';
import { isFuzzyTitleMatch } from '../../core/utils/search-fuzzy.util';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonToolbar, IonSearchbar, IonButtons, IonBackButton,
    IonIcon, IonInfiniteScroll, IonInfiniteScrollContent,
    IonSpinner, CommonModule, FormsModule, EmptyStateComponent
  ]
})
export class SearchPage implements OnInit {
  public store = inject(SearchStore);
  public franchiseAggregator = inject(FranchiseAggregatorService);
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private posterCache = inject(PosterCacheService);
  private navCtrl = inject(NavController);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private tour = inject(AppTourService);

  @ViewChild(IonSearchbar) searchbar!: IonSearchbar;

  public readonly loadedUrls = signal<Record<string, boolean>>({});

  public readonly filterOptions: { id: SearchFilter; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'layers-outline' },
    { id: 'movie', label: 'Movies', icon: 'film-outline' },
    { id: 'tv', label: 'TV Series', icon: 'tv-outline' },
    { id: 'collection', label: 'Franchises', icon: 'albums-outline' },
    { id: 'person', label: 'People', icon: 'person-outline' }
  ];

  public readonly matchingUserFranchises = computed<FranchiseCollectionSummary[]>(() => {
    const rawQuery = this.store.query().trim().toLowerCase();
    if (!rawQuery) return [];
    const corrected = this.store.correctedQuery()?.trim().toLowerCase();
    const stemQuery = rawQuery
      .replace(/\b(saga|franchise|collection|series|universe)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || rawQuery;

    const all = this.franchiseAggregator.activeUserFranchises();
    return all.filter((f) => {
      const nameLower = f.name.toLowerCase();
      if (
        nameLower.includes(rawQuery) ||
        (stemQuery.length >= 2 && isFuzzyTitleMatch(stemQuery, nameLower)) ||
        (corrected && isFuzzyTitleMatch(corrected, nameLower))
      ) {
        return true;
      }
      if (f.siblingFranchises?.some((s) => isFuzzyTitleMatch(stemQuery, s.name))) {
        return true;
      }
      return false;
    });
  });

  public readonly matchingLibraryMedia = computed(() => {
    const rawQuery = this.store.query().trim().toLowerCase();
    if (!rawQuery || rawQuery.length < 2) return [];
    const corrected = this.store.correctedQuery()?.trim().toLowerCase();

    const watchlist = this.storageService.watchlistItems();
    const watched = this.storageService.watchedItems();
    const combined = [...watchlist, ...watched];

    const seen = new Set<string>();
    const matched: {
      id: string;
      doc: ContentDocType;
      title: string;
      posterUrl: string;
      year: string;
      status: 'watched' | 'watchlist';
    }[] = [];

    for (const doc of combined) {
      if (doc.mediaType === 'person') continue;
      const key = `${doc.mediaType}_${doc.tmdbId}`;
      if (seen.has(key)) continue;

      const payload = doc.payload as Record<string, unknown> | undefined;
      const title = String(payload?.['title'] || payload?.['name'] || '').trim();
      if (!title) continue;

      if (
        isFuzzyTitleMatch(rawQuery, title) ||
        (corrected && isFuzzyTitleMatch(corrected, title))
      ) {
        seen.add(key);
        const rawPath = (payload?.['poster_path'] || payload?.['posterUrl']) as string | undefined;
        const rawDate = String(payload?.['release_date'] || payload?.['first_air_date'] || '');
        const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : '';
        const status = doc.lists.includes('watched') ? 'watched' : 'watchlist';

        matched.push({
          id: doc.id,
          doc,
          title,
          posterUrl: this.resolveImage(rawPath),
          year,
          status
        });
      }
    }
    return matched.slice(0, 8);
  });

  public isImageLoaded(url: string | null | undefined): boolean {
    if (!url) return false;
    const warm = typeof this.posterCache.isWarm === 'function' && this.posterCache.isWarm(url);
    return Boolean(this.loadedUrls()[url]) || warm;
  }

  public onImageLoad(event: Event, url: string | null | undefined): void {
    if (!url) return;
    const img = event.target as HTMLImageElement | null;
    if (typeof this.posterCache.markLoaded === 'function') {
      this.posterCache.markLoaded(url, img ?? undefined);
    }
    this.loadedUrls.update((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }

  public onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src !== DEFAULT_POSTER_PLACEHOLDER) {
      img.src = DEFAULT_POSTER_PLACEHOLDER;
    }
    this.loadedUrls.update((prev) => ({ ...prev, [DEFAULT_POSTER_PLACEHOLDER]: true, [img.src]: true }));
  }

  public onLibraryMediaClick(item: ContentDocType): void {
    const query = this.store.query();
    if (query.trim()) {
      this.store.saveSearchToHistory(query);
    }
    const payload = item.payload as Record<string, unknown> | undefined;
    const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
    const title = String(payload?.['title'] || payload?.['name'] || '');
    const rawDate = String(payload?.['release_date'] || payload?.['first_air_date'] || '');
    const rawPath = (payload?.['poster_path'] || payload?.['posterUrl']) as string | undefined;
    const rating = Number(payload?.['vote_average'] || 0);

    void this.router.navigate(['/media', mediaType, item.tmdbId], {
      state: {
        preview: {
          id: item.tmdbId,
          mediaType,
          title,
          overview: payload?.['overview'] as string | undefined,
          posterUrl: this.resolveImage(rawPath),
          backdropUrl: payload?.['backdrop_path'] ? resolveMediaImageUrl(payload['backdrop_path'] as string, 'w1280') : undefined,
          releaseYear: rawDate.length >= 4 ? rawDate.slice(0, 4) : '',
          rating: rating > 0 ? rating.toFixed(1) : undefined
        }
      }
    });
  }

  public trackById(index: number, item: { id: number | string }): number | string {
    return item.id;
  }
  public trackByString(index: number, item: string): string {
    return item;
  }

  constructor() {
    addIcons({
      timeOutline, closeCircle, closeOutline, searchOutline, filmOutline, tvOutline,
      personOutline, sparkles, sparklesOutline, alertCircle, bookmark, bookmarkOutline, checkmarkCircle,
      layersOutline, albumsOutline, chevronForwardOutline, ribbonOutline, arrowForwardOutline, trashOutline
    });
  }

  ngOnInit(): void {
    this.store.loadRecentSearches();
    this.applyQueryParams();
  }

  public ionViewWillEnter(): void {
    this.applyQueryParams();
  }

  public ionViewDidEnter(): void {
    if (this.tour.isActive()) {
      return;
    }

    // Wait for Android view transition animation to settle before focusing and opening native keyboard
    setTimeout(async () => {
      if (this.tour.isActive()) {
        return;
      }
      try {
        if (this.searchbar) {
          await this.searchbar.setFocus();
        }
        await Keyboard.show();
      } catch (err) {
        console.debug('[SearchPage] Native keyboard auto-open skipped:', err);
      }
    }, 200);
  }

  private applyQueryParams(): void {
    const qParams = this.route.snapshot.queryParams;
    const filterParam = qParams['filter'] as SearchFilter | undefined;
    if (filterParam && this.filterOptions.some((o) => o.id === filterParam)) {
      this.store.setActiveFilter(filterParam);
    }
    const queryParam = typeof qParams['q'] === 'string' ? qParams['q'].trim() : '';
    if (queryParam) {
      this.store.searchQuery(queryParam);
    }
  }

  public setFilter(filter: SearchFilter): void {
    this.store.setActiveFilter(filter);
  }

  public onCollectionClick(collection: TmdbCollectionListItemDto | FranchiseCollectionSummary): void {
    const query = this.store.query();
    if (query.trim()) {
      this.store.saveSearchToHistory(query);
    }
    const targetId =
      'isUniverse' in collection && collection.isUniverse && collection.universeId
        ? collection.universeId
        : collection.id;
    void this.router.navigate(['/collection', targetId], {
      state: {
        preview: {
          id: targetId,
          name: collection.name,
          posterUrl: this.resolveImage(collection.poster_path),
          backdropUrl: collection.backdrop_path ? resolveMediaImageUrl(collection.backdrop_path, 'w1280') : undefined
        }
      }
    });
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
    if (item.media_type === 'person') {
      void this.router.navigate(['/person', item.id], {
        state: {
          preview: {
            id: item.id,
            name: item.name,
            profileUrl: this.resolveImage(item.profile_path),
            knownForDepartment: item.known_for_department
          }
        }
      });
      return;
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
      const prevState = this.storageService.getBookmarkState(item.id, item.media_type);
      const nextState = await this.storageService.cycleBookmark(item.id, item.media_type, payload);
      if (nextState === 'watchlist') {
        await this.toastService.presentSuccess(`Added "${title}" to Watchlist`, 1800);
      } else if (nextState === 'watched') {
        await this.toastService.presentInfo(`Marked "${title}" as Watched`, 1800);
      } else if (prevState === 'watchlist') {
        await this.toastService.presentWarning(`Removed "${title}" from Watchlist (not released yet — cannot mark Watched)`, 2200);
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
