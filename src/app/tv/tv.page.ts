import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonModal, IonHeader, IonToolbar, IonTitle, IonChip, IonLabel, IonFooter
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { add, bookmark, checkmarkDone, options, trash, optionsOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { TvDetailModel } from 'src/models/tv/tv-detail.model';
import { Subscription } from 'rxjs';
import { StorageService } from 'src/services/storage.service';

@Component({
  selector: 'app-tv',
  templateUrl: 'tv.page.html',
  styleUrls: ['tv.page.scss'],
  imports: [IonLabel, IonChip, IonTitle, IonToolbar, IonHeader, IonModal, IonFooter,
    IonCheckbox,
    IonButtons,
    IonButton,
    IonIcon,
    FormsModule,
    CommonModule,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent],
})
export class TvPage implements OnInit, OnDestroy {
  segment: 'watchlist' | 'watched' = 'watchlist';
  watchlist: TvDetailModel[] = [];
  watched: TvDetailModel[] = [];
  selectionMode = false;
  selectedIds = new Set<number>();
  filterOpen = false;
  popoverEvent: any = null;
  genres: string[] = [];
  selectedGenres = new Set<string>();
  storageSub!: Subscription;
  sortBy: 'default' | 'title' | 'rating' | 'date' = 'default';

  constructor(
    private router: Router,
    private storageService: StorageService
  ) {
    addIcons({
      add,
      trash,
      bookmark,
      checkmarkDone,
      options,
      optionsOutline
    });
  }

  ngOnInit() {
    this.storageSub = this.storageService.storageChanged$.subscribe(() => {
      this.loadTv();
    });
    this.loadTv();
  }

  ngOnDestroy() {
    this.storageSub?.unsubscribe();
  }

  async loadTv() {
    const [watchlistItems, watchedItems] = await Promise.all([
      this.storageService.getWatchlist(),
      this.storageService.getWatched()
    ]);

    const tvWatchlist = watchlistItems.filter(item => item.isTv).reverse();
    const tvWatched = watchedItems.filter(item => item.isTv).reverse();

    this.watchlist = tvWatchlist.map(item => ({
      id: item.contentId,
      name: item.name,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      first_air_date: item.first_air_date
    }));

    this.watched = tvWatched.map(item => ({
      id: item.contentId,
      name: item.name,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      first_air_date: item.first_air_date
    }));

    const gSet = new Set<string>();
    [...this.watchlist, ...this.watched].forEach(tv => tv.genres?.forEach(g => gSet.add(g.name!)));
    this.genres = Array.from(gSet).sort();

    for (const selected of this.selectedGenres) {
      if (!this.genres.includes(selected)) {
        this.selectedGenres.delete(selected);
      }
    }
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
    this.sortBy = 'default'; // Reset sort as well
    // Don't close the modal immediately so the user sees the chips clear
  }

  getCurrentTv(): TvDetailModel[] {
    const base = this.segment === 'watchlist' ? this.watchlist : this.watched;

    // 1. GENRE FILTERING (Gracefully handles missing genres)
    let filtered = base;
    if (this.selectedGenres.size > 0) {
      filtered = base.filter(tv => tv.genres && tv.genres.some(g => this.selectedGenres.has(g.name!)));
    }

    // 2. PERFORMANCE BOOST: If default, skip the expensive sort entirely!
    if (this.sortBy === 'default') {
      return filtered;
    }

    // 3. BULLETPROOF SORTING WITH TIE-BREAKERS
    return [...filtered].sort((a, b) => {

      if (this.sortBy === 'title') {
        return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
      }

      else if (this.sortBy === 'rating') {
        const diff = (b.vote_average || 0) - (a.vote_average || 0);
        // TIE-BREAKER
        if (diff === 0) {
          return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
        }
        return diff;
      }

      else if (this.sortBy === 'date') {
        const timeA = a.first_air_date ? new Date(a.first_air_date).getTime() : 0;
        const timeB = b.first_air_date ? new Date(b.first_air_date).getTime() : 0;
        const safeTimeA = isNaN(timeA) ? 0 : timeA;
        const safeTimeB = isNaN(timeB) ? 0 : timeB;

        const diff = safeTimeB - safeTimeA;
        // TIE-BREAKER
        if (diff === 0) {
          return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
        }
        return diff;
      }

      return 0;
    });
  }

  goToSearch() {
    this.router.navigate(['/search']);
  }

  goToTvDetail(id?: number | string) {
    this.router.navigate(['/tv-detail', id]);
  }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedIds.clear();
    }
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
      this.toggleSelect(Number(tvId));
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

  trackById(index: number, item: any) {
    return item.id;
  }
}
