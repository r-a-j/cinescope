import { Component, OnInit } from '@angular/core';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonButtons,
  IonButton,
  IonCheckbox,
  IonModal,
  IonChip,
  IonHeader,
  IonToolbar,
  IonTitle, IonLabel, IonFooter
} from "@ionic/angular/standalone";
import { HeaderComponent } from '../header/header.component';
import { Router } from '@angular/router';
import { bookmark, checkmarkDone, options, trash, construct, optionsOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StorageService } from 'src/services/storage.service';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';

@Component({
  selector: 'app-movie',
  templateUrl: 'movie.page.html',
  styleUrls: ['movie.page.scss'],
  imports: [IonLabel,
    IonModal,
    IonFooter,
    IonChip,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCheckbox,
    IonButton,
    IonButtons,
    FormsModule,
    CommonModule,
    IonIcon,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent
  ],
})
export class MoviePage implements OnInit {
  segment: 'watchlist' | 'watched' = 'watchlist';
  watchlist: MovieDetailModel[] = [];
  watched: MovieDetailModel[] = [];

  selectionMode = false;
  selectedIds = new Set<number>();

  filterOpen = false;
  popoverEvent: any = null;
  genres: string[] = [];
  selectedGenres = new Set<string>();

  sortBy: 'default' | 'title' | 'rating' | 'date' = 'default';

  constructor(
    private router: Router,
    private storageService: StorageService
  ) {
    addIcons({ trash, bookmark, checkmarkDone, options, construct, optionsOutline });
  }

  ngOnInit() {
    this.storageService.storageChanged$.subscribe(() => {
      this.loadMovies();
    });
    this.loadMovies();
  }

  async loadMovies() {
    const [watchlistItems, watchedItems] = await Promise.all([
      this.storageService.getWatchlist(),
      this.storageService.getWatched()
    ]);

    const movieWatchlist = watchlistItems.filter(item => item.isMovie).reverse();
    const movieWatched = watchedItems.filter(item => item.isMovie).reverse();

    this.watchlist = movieWatchlist.map(item => ({
      id: item.contentId,
      title: item.title,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      release_date: item.release_date
    }));

    this.watched = movieWatched.map(item => ({
      id: item.contentId,
      title: item.title,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      release_date: item.release_date
    }));

    const gSet = new Set<string>();
    [...this.watchlist, ...this.watched].forEach(m => m.genres?.forEach(g => gSet.add(g.name!)));
    this.genres = Array.from(gSet).sort();

    for (const selected of this.selectedGenres) {
      if (!this.genres.includes(selected)) {
        this.selectedGenres.delete(selected);
      }
    }
  }

  openFilter(ev: Event) {
    this.popoverEvent = ev;
    this.filterOpen = true;
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

  getCurrentMovies(): MovieDetailModel[] {
    const base = this.segment === 'watchlist' ? this.watchlist : this.watched;

    // 1. GENRE FILTERING (Gracefully handles missing genres)
    let filtered = base;
    if (this.selectedGenres.size > 0) {
      filtered = base.filter(m => m.genres && m.genres.some(g => this.selectedGenres.has(g.name!)));
    }

    // 2. PERFORMANCE BOOST: If default, skip the expensive sort entirely!
    if (this.sortBy === 'default') {
      return filtered;
    }

    // 3. BULLETPROOF SORTING WITH TIE-BREAKERS
    return [...filtered].sort((a, b) => {

      if (this.sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
      }

      else if (this.sortBy === 'rating') {
        const diff = (b.vote_average || 0) - (a.vote_average || 0);
        // TIE-BREAKER: If ratings are exactly the same, sort them alphabetically instead of randomizing
        if (diff === 0) {
          return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
        }
        return diff;
      }

      else if (this.sortBy === 'date') {
        const timeA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const timeB = b.release_date ? new Date(b.release_date).getTime() : 0;
        const safeTimeA = isNaN(timeA) ? 0 : timeA;
        const safeTimeB = isNaN(timeB) ? 0 : timeB;

        const diff = safeTimeB - safeTimeA;
        // TIE-BREAKER: If released on the exact same day, sort alphabetically
        if (diff === 0) {
          return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
        }
        return diff;
      }

      return 0;
    });
  }

  goToSearch() {
    this.router.navigate(['/search']);
  }

  goToMovieDetail(id?: number | string) {
    this.router.navigate(['/movie-detail', id]);
  }

  goToSkeletonTest() {
    this.router.navigate(['/skeleton-test']);
  }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedIds.clear();
    }
  }

  toggleSelect(movieId: number) {
    if (this.selectedIds.has(movieId)) {
      this.selectedIds.delete(movieId);
    } else {
      this.selectedIds.add(movieId);
    }
  }

  onMovieClick(movieId?: number | string) {
    if (this.selectionMode) {
      this.toggleSelect(Number(movieId));
    } else {
      this.goToMovieDetail(movieId);
    }
  }

  clearSelection() {
    this.selectionMode = false;
    this.selectedIds.clear();
  }

  async removeSelected() {
    const moviesToRemove = this.getCurrentMovies().filter(movie => this.selectedIds.has(movie.id!));

    if (this.segment === 'watchlist') {
      for (const movie of moviesToRemove) {
        await this.storageService.removeFromWatchlist(movie.id!, true, false);
      }
    }
    else {
      for (const movie of moviesToRemove) {
        await this.storageService.removeFromWatched(movie.id!, true, false);
      }
    }

    this.clearSelection();
    this.loadMovies();
  }

  async moveSelectedToWatched() {
    const ids = Array.from(this.selectedIds);
    await this.storageService.bulkMoveFromWatchlistToWatched(ids, true, false);
    this.clearSelection();
    this.loadMovies();
  }

  trackById(index: number, item: any) {
    return item.id;
  }
}