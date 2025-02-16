import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MovieSearchModalComponent } from '../movie-search-modal/movie-search-modal.component';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  // Start with some example movies, or empty
  movies: any = [];

  constructor(private modalController: ModalController) { }

  async openModal() {
    const modal = await this.modalController.create({
      component: MovieSearchModalComponent,
      componentProps: {
        watchlist: this.movies, // pass watchlist to modal
      },
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        // Add the returned movie to the watchlist
        this.movies.push(result.data);
      }
    });

    await modal.present();
  }
}