import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { MovieSearchModalComponent } from '../movie-search-modal/movie-search-modal.component';
import { MovieService } from 'src/app/services/movie.service';
import { MovieDetails, RecommendationsResult } from 'src/app/models/movie-details.model';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit {
  watchlist: MovieDetails[] = [];
  
  constructor(
    private modalController: ModalController,
    private movieService: MovieService,
    private toastController: ToastController
  ) { }

  async ngOnInit() {
    await this.loadWatchlist();
  }

  async loadWatchlist() {
    this.watchlist = await this.movieService.getWatchlist();
  }

  // Called every time the view is about to enter
  ionViewWillEnter(): void {
    this.loadWatchlist();
  }
  
  async openModal() {
    const modal = await this.modalController.create({
      component: MovieSearchModalComponent,
      componentProps: {
        watchlist: this.watchlist,
      },
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        if (result.data.action === 'watchlist') {
          this.movieService.addToWatchlist(result.data.movie);
        } else if (result.data.action === 'watched') {
          this.movieService.moveToWatched(result.data.movie);
        }
      }
      
      // Refresh the watchlist after the action
      await this.loadWatchlist();
    });

    await modal.present();
  }

  async moveToWatched(movie: MovieDetails) {
    await this.movieService.moveToWatched(movie);
    await this.loadWatchlist();
  }

  async openMovieDetails(movieId: number) {
    const modal = await this.modalController.create({
      component: MovieDetailModalComponent,
      componentProps: { movieId }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        if (result.data.action === 'watchlist') {
          this.movieService.addToWatchlist(result.data.movie);
          const toast = await this.toastController.create({
            message: `${result.data.movie.title} added to Watchlist!`,
            duration: 2000,
            position: 'top',
            color: 'success',
          });
          await toast.present();
        } else if (result.data.action === 'watched') {
          this.movieService.moveToWatched(result.data.movie);
          const toast = await this.toastController.create({
            message: `${result.data.movie.title} added to Watched!`,
            duration: 2000,
            position: 'top',
            color: 'success',
          });
          await toast.present();
        }

        // Refresh the watchlist after the action
        await this.loadWatchlist();
      }
    });

    await modal.present();
  }
}