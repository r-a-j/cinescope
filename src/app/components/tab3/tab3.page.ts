import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';
import { MovieService } from 'src/app/services/movie.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit {
  movies: any[] = [];

  constructor(
    private modalCtrl: ModalController,
    private movieService: MovieService
  ) { }

  ngOnInit(): void {
    this.loadMovies();
  }

  /**
   * Loads movies by subscribing to the MovieService.
   */
  loadMovies(): void {
    this.movieService.getMovies().subscribe({
      next: (data) => {
        this.movies = data.results;
      },
      error: (error) => {
        console.error('Error fetching movies:', error);
      }
    });
  }

  /**
   * Opens the movie details modal and handles actions from the modal.
   * @param movieId The ID of the movie to show details for
   */
  async openMovieDetails(movieId: number): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: MovieDetailModalComponent,
      componentProps: { movieId }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        if (result.data.action === 'watchlist') {
          this.movieService.addToWatchlist(result.data.movie);
        } else if (result.data.action === 'watched') {
          this.movieService.moveToWatched(result.data.movie);
        }
      }
    });

    await modal.present();
  }
}
