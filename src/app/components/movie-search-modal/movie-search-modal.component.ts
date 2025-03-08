import { Component, Input, OnDestroy } from '@angular/core';
import { IonicModule, ModalController, Platform, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecommendationsResult } from 'src/app/models/movie-details.model';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';
import { MovieService } from 'src/app/services/movie.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-movie-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './movie-search-modal.component.html',
  styleUrls: ['./movie-search-modal.component.scss'],
})
export class MovieSearchModalComponent implements OnDestroy {
  @Input() watchlist: RecommendationsResult[] = [];

  searchQuery: string = '';
  filteredMovies: RecommendationsResult[] = [];
  private searchTimeout: any;

  private backButtonSubscription!: Subscription;
  
  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private movieService: MovieService,
    private platform: Platform
  ) { }

  ngOnDestroy(): void {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  dismiss(): void {
    this.modalController.dismiss();
  }

  /**
   * Searches movies using the movie service.
   * Implements a debounce with setTimeout.
   */
  searchMovies(): void {
    if (!this.searchQuery.trim()) {
      this.filteredMovies = [];
      return;
    }

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.movieService.searchMovies(this.searchQuery.trim()).subscribe({
        next: (data) => {
          const results = data.results || [];
          // Map raw results to RecommendationsResult objects
          this.filteredMovies = results
            .map((r: any): RecommendationsResult => ({
              backdrop_path: r.backdrop_path,
              id: r.id,
              title: r.title,
              original_title: r.original_title,
              overview: r.overview,
              poster_path: r.poster_path ? r.poster_path : 'assets/placeholder.png',
              media_type: r.media_type,
              adult: r.adult,
              original_language: r.original_language,
              genre_ids: r.genre_ids,
              popularity: r.popularity,
              release_date: new Date(r.release_date),
              video: r.video,
              vote_average: r.vote_average,
              vote_count: r.vote_count,
            }))
            .filter((movie: RecommendationsResult) =>
              !this.watchlist.some((w: RecommendationsResult) => w.title === movie.title)
            );
        },
        error: (err) => {
          console.error(err);
          this.filteredMovies = [];
        }
      });
    }, 500);
  }

  /**
   * Opens the movie details modal for a selected movie.
   * @param movie The movie for which to display details.
   */
  async openMovieDetails(movie: RecommendationsResult): Promise<void> {
    const detailModal = await this.modalController.create({
      component: MovieDetailModalComponent,
      componentProps: { movieId: movie.id }
    });

    detailModal.onDidDismiss().then(async (result) => {
      if (result.data) {
        if (result.data.action === 'watchlist') {
          this.movieService.addToWatchlist(result.data.movie);
          const toast = await this.toastController.create({
            message: `${result.data.movie.title} added to Watchlist!`,
            duration: 2000,
            color: 'custom-red'
          });
          await toast.present();
        } else if (result.data.action === 'watched') {
          this.movieService.moveToWatched(result.data.movie);
          const toast = await this.toastController.create({
            message: `${result.data.movie.title} added to Watched!`,
            duration: 2000,
            color: 'custom-red'
          });
          await toast.present();
        }
        // Remove the movie from the filtered list after adding it to a list.
        this.filteredMovies = this.filteredMovies.filter(
          (m: RecommendationsResult) => m.id !== result.data.movie.id
        );
      }
    });

    await detailModal.present();
  }
}