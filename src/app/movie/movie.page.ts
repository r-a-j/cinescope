import { Component, OnInit } from '@angular/core';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonFabButton,
  IonFab,
  IonIcon,
  IonButtons,
  IonButton,
  IonCheckbox,
  IonModal,
  IonChip,
  IonHeader,
  IonToolbar,
  IonTitle, IonLabel
} from "@ionic/angular/standalone";
import { HeaderComponent } from '../header/header.component';
import { Router } from '@angular/router';
import { bookmark, checkmarkDone, options, trash, construct } from 'ionicons/icons';
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
    IonFab,
    IonFabButton,
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
    addIcons({ trash, bookmark, checkmarkDone, options, construct });
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

    // 1. First, apply Genre Filtering
    let filtered = base;
    if (this.selectedGenres.size > 0) {
      filtered = base.filter(m => m.genres?.some(g => this.selectedGenres.has(g.name!)));
    }

    // 2. Then, apply Sorting
    return filtered.sort((a, b) => {
      if (this.sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      } else if (this.sortBy === 'rating') {
        return (b.vote_average || 0) - (a.vote_average || 0); // High to Low
      } else if (this.sortBy === 'date') {
        return new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime(); // Newest first
      }
      return 0; // Default (Order they were saved)
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
    console.log('Pressed toggleSelectionMode', this.selectionMode);
    this.selectionMode = !this.selectionMode;
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