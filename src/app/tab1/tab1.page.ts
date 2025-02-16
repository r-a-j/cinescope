import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MovieSearchModalComponent } from '../movie-search-modal/movie-search-modal.component';
import { MovieService } from 'src/services/movie.service';
import { RecommendationsResult } from 'src/models/movie-details.model';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  private longPressTimeout: any;

  constructor(
    private modalController: ModalController,
    private movieService: MovieService
  ) { }

  get movies(): RecommendationsResult[] {
    return this.movieService.watchlist;
  }

  async openModal() {
    const modal = await this.modalController.create({
      component: MovieSearchModalComponent,
      componentProps: {
        watchlist: this.movieService.watchlist,
      },
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

  moveToWatched(movie: RecommendationsResult) {
    this.movieService.moveToWatched(movie);
  }

  async openMovieDetails(movieId: number) {
    const modal = await this.modalController.create({
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