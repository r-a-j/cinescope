import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { MovieDetails, RecommendationsResult } from 'src/app/models/movie-details.model';
import { MovieService } from 'src/app/services/movie.service';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit {
  watchedMovies: MovieDetails[] = [];
  
  constructor(
    private movieService: MovieService,
    private modalController: ModalController,
    private toastController: ToastController
  ) { }

  async ngOnInit() {
    await this.loadWatchedMovies();
  }
  
  async loadWatchedMovies() {
    this.watchedMovies = await this.movieService.getWatched();
  }

  // Called every time the view is about to enter
  ionViewWillEnter(): void {
    this.loadWatchedMovies();
  }

  // 3) Method to open the modal
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
        await this.loadWatchedMovies();
      }
    });

    await modal.present();
  }
}
