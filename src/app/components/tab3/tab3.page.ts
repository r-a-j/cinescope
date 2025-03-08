import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';
import { MovieService } from 'src/app/services/movie.service';
import { LoaderService } from 'src/app/services/loader.service';

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
  async loadMovies(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.movieService.getMovies().subscribe({
        next: (data) => {
          this.movies = data.results;
          resolve();
        },
        error: (error) => {
          console.error('Error fetching movies:', error);
          reject(error);
        }
      });
    });
  }

  // Called every time the view is about to enter
  ionViewWillEnter(): void {
    this.loadMovies();
  }

  /**
   * Opens the movie details modal and handles actions from the modal.
   * @param movieId The ID of the movie to show details for.
   */
  async openMovieDetails(movieId: number): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: MovieDetailModalComponent,
      componentProps: { movieId }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        if (result.data.action === 'watchlist') {
          await this.movieService.addToWatchlist(result.data.movie);
        } else if (result.data.action === 'watched') {
          await this.movieService.moveToWatched(result.data.movie);
        }
      }
      
      // Refresh the movies list after the action
      await this.loadMovies();
    });

    await modal.present();
  }
}
