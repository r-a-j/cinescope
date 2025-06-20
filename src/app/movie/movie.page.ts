import { Component, OnDestroy, OnInit } from '@angular/core';
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
  IonPopover,
  IonList,
  IonItem,
  IonLabel
} from "@ionic/angular/standalone";
import { HeaderComponent } from '../header/header.component';
import { NavigationEnd, Router } from '@angular/router';
import { bookmark, checkmarkDone, options, trash } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StorageService } from 'src/services/storage.service';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import { ContentModel } from 'src/models/content.model';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';

@Component({
  selector: 'app-movie',
  templateUrl: 'movie.page.html',
  styleUrls: ['movie.page.scss'],
  imports: [
    IonPopover,
    IonList,
    IonItem,
    IonLabel,
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
    HeaderComponent],
})
export class MoviePage implements OnInit, OnDestroy {
  segment: 'watchlist' | 'watched' = 'watchlist';
  watchlist: MovieDetailModel[] = [];
  watched: MovieDetailModel[] = [];

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
    addIcons({ trash, bookmark, checkmarkDone, options });
  }

  ngOnInit() {
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.urlAfterRedirects.includes('tabs/movie')) {
          console.log('Back on Movie Page');
          this.loadMovies();
        }
      });
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
  }

  async loadMovies() {
    this.watchlist = [];
    this.watched = [];

    const [watchlistItems, watchedItems] = await Promise.all([
      this.storageService.getWatchlist(),
      this.storageService.getWatched()
    ]);

    const uniqueWatchlistItems = Array.from(new Set(watchlistItems.map(item => item.contentId)))
      .map(id => watchlistItems.find(item => item.contentId === id && item.isMovie === true))
      .filter((item): item is ContentModel => item !== undefined);

    const uniqueWatchedItems = Array.from(new Set(watchedItems.map(item => item.contentId)))
      .map(id => watchedItems.find(item => item.contentId === id && item.isMovie === true))
      .filter((item): item is ContentModel => item !== undefined);

    const promises = [...uniqueWatchlistItems, ...uniqueWatchedItems].map(async (item) => {
      try {
        const movieDetail = await firstValueFrom(this.tmdbService.getMovieDetail(item.contentId));

        const movieItem: MovieDetailModel = {
          id: movieDetail?.id,
          title: movieDetail?.title,
          poster_path: movieDetail?.poster_path,
          genres: movieDetail?.genres,
        };

        if (item.isWatched) {
          this.watched.push(movieItem);
        } else {
          this.watchlist.push(movieItem);
        }
      } catch (error) {
        console.error('Failed to fetch movie', item.contentId, error);
      }
    });

    await Promise.all(promises);

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
    this.selectedGenres.clear(); this.filterOpen = false; 
  }
  
  getCurrentMovies(): MovieDetailModel[] {
    const base = this.segment === 'watchlist' ? this.watchlist : this.watched;
    
    if (this.selectedGenres.size === 0) { 
      return base; 
    }

    return base.filter(m => m.genres?.some(g => this.selectedGenres.has(g.name!)));
  }

  goToSearch() {
    this.router.navigate(['/search']);
  }

  goToMovieDetail(id?: number | string) {
    this.router.navigate(['/movie-detail', id]);
  }

  toggleSelectionMode() {
    console.log('Pressed toggleSelectionMode', this.selectionMode);
    this.selectionMode = !this.selectionMode;
    //this.toggleSelect(movieId!);
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
      this.toggleSelect(Number(movieId)); // just toggle selection
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
}