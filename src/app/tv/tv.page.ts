import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonFab,
  IonFabButton,
  IonPopover,
  IonList,
  IonItem,
  IonLabel
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { add, bookmark, checkmarkDone, options, trash } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { TvDetailModel } from 'src/models/tv/tv-detail.model';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import { StorageService } from 'src/services/storage.service';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { ContentModel } from 'src/models/content.model';

@Component({
  selector: 'app-tv',
  templateUrl: 'tv.page.html',
  styleUrls: ['tv.page.scss'],
  imports: [
    IonPopover,
    IonList,
    IonItem,
    IonLabel,
    IonFabButton,
    IonFab,
    IonCheckbox,
    IonButtons,
    IonButton,
    IonIcon,
    FormsModule,
    CommonModule,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent
  ],
})
export class TvPage implements OnInit, OnDestroy {
  segment: 'watchlist' | 'watched' = 'watchlist';
  watchlist: TvDetailModel[] = [];
  watched: TvDetailModel[] = [];

  selectionMode = false;
  selectedIds = new Set<number>();

  private routerSubscription!: Subscription;

  filterOpen = false;
  popoverEvent: any = null;
  genres: string[] = [];
  selectedGenres = new Set<string>();

  constructor(
    private router: Router,
    private storageService: StorageService,
    private tmdbService: TmdbSearchService
  ) {
    addIcons({ add, trash, bookmark, checkmarkDone, options });
  }

  ngOnInit() {
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.urlAfterRedirects.includes('tabs/tv')) {
          console.log('Back on Tv Page');
          this.loadTv();
        }
      });
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
  }

  async loadTv() {
    this.watchlist = [];
    this.watched = [];

    const [watchlistItems, watchedItems] = await Promise.all([
      this.storageService.getWatchlist(),
      this.storageService.getWatched()
    ]);

    const uniqueWatchlistItems = Array.from(new Set(watchlistItems.map(item => item.contentId)))
      .map(id => watchlistItems.find(item => item.contentId === id && item.isTv === true))
      .filter((item): item is ContentModel => item !== undefined);

    const uniqueWatchedItems = Array.from(new Set(watchedItems.map(item => item.contentId)))
      .map(id => watchedItems.find(item => item.contentId === id && item.isTv === true))
      .filter((item): item is ContentModel => item !== undefined);

    const promises = [...uniqueWatchlistItems, ...uniqueWatchedItems].map(async (item) => {
      try {
        const tvDetail = await firstValueFrom(this.tmdbService.getTvDetail(item.contentId));

        const tvItem: TvDetailModel = {
          id: tvDetail?.id!,
          name: tvDetail?.name,
          poster_path: tvDetail?.poster_path,
          genres: tvDetail?.genres          
        };

        if (item.isWatched) {
          this.watched.push(tvItem);
        } else {
          this.watchlist.push(tvItem);
        }
      } catch (error) {
        console.error('Failed to fetch tv', item.contentId, error);
      }
    });

    await Promise.all(promises);

    const gSet = new Set<string>();
    [...this.watchlist, ...this.watched].forEach(tv => tv.genres?.forEach(g => gSet.add(g.name!)));
    this.genres = Array.from(gSet).sort();
  }

  openFilter(ev: Event) {
    this.popoverEvent = ev; this.filterOpen = true;
  }

  toggleGenre(g: string) {
    this.selectedGenres.has(g) ? this.selectedGenres.delete(g) : this.selectedGenres.add(g);
  }

  applyFilter() {
    this.filterOpen = false;
  }

  clearFilter() {
    this.selectedGenres.clear();
    this.filterOpen = false;
  }

  /** returns TVs respecting active genre filter */
  getCurrentTv(): TvDetailModel[] {
    const base = this.segment === 'watchlist' ? this.watchlist : this.watched;
    if (this.selectedGenres.size === 0) { return base; }

    return base.filter(tv =>
      tv.genres?.some(g => this.selectedGenres.has(g.name!))
    );
  }

  goToSearch() {
    this.router.navigate(['/search']);
  }

  goToTvDetail(id?: number | string) {
    this.router.navigate(['/tv-detail', id]);
  }

  toggleSelectionMode() {
    console.log('Pressed toggleSelectionMode', this.selectionMode);
    this.selectionMode = !this.selectionMode;
    //this.toggleSelect(tvId!);
  }

  toggleSelect(tvId: number) {
    if (this.selectedIds.has(tvId)) {
      this.selectedIds.delete(tvId);
    } else {
      this.selectedIds.add(tvId);
    }
  }

  onTvClick(tvId?: number | string) {
    if (this.selectionMode) {
      this.toggleSelect(Number(tvId)); // just toggle selection
    } else {
      this.goToTvDetail(tvId);
    }
  }

  clearSelection() {
    this.selectionMode = false;
    this.selectedIds.clear();
  }

  async removeSelected() {
    const tvToRemove = this.getCurrentTv().filter(tv => this.selectedIds.has(tv.id!));

    if (this.segment === 'watchlist') {
      for (const tv of tvToRemove) {
        await this.storageService.removeFromWatchlist(tv.id!, false, true);
      }
    }
    else {
      for (const tv of tvToRemove) {
        await this.storageService.removeFromWatched(tv.id!, false, true);
      }
    }

    this.clearSelection();
    this.loadTv();
  }

  async moveSelectedToWatched() {
    const ids = Array.from(this.selectedIds);
    await this.storageService.bulkMoveFromWatchlistToWatched(ids, false, true);
    this.clearSelection();
    this.loadTv();
  }
}
