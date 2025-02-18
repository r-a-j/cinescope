import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { RecommendationsResult } from 'src/models/movie-details.model';
import { MovieService } from 'src/services/movie.service';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {

  constructor(
    private movieService: MovieService,
    private modalCtrl: ModalController
  ) { }

  get watchedMovies(): RecommendationsResult[] {
    return this.movieService.watched;
  }

  // 3) Method to open the modal
  async openMovieDetail(movieId: number) {
    const modal = await this.modalCtrl.create({
      component: MovieDetailModalComponent,
      componentProps: { movieId }
    });
    await modal.present();

    // Optionally handle the data returned on dismiss
    const { data } = await modal.onDidDismiss();
    if (data?.action === 'watchlist') {
      console.log('User added movie to watchlist:', data.movie.title);
      // If you want to do something with the watchlist result, do it here
    } else if (data?.action === 'watched') {
      console.log('User marked movie as watched:', data.movie.title);
      // If you want to handle that event, do it here
    }
  }
}
