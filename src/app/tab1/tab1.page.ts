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

  movies = [
    { title: 'Inception', poster: 'assets/inception.jpg' },
    { title: 'Breaking Bad', poster: 'assets/breaking_bad.jpg' },
    { title: 'Stranger Things', poster: 'assets/stranger_things.jpg' },
    { title: 'Dark', poster: 'assets/dark.jpg' },
    { title: 'Interstellar', poster: 'assets/interstellar.jpg' }
  ];

  constructor(private modalController: ModalController) { }

  async openModal() {
    const modal = await this.modalController.create({
      component: MovieSearchModalComponent,
      componentProps: {
        watchlist: this.movies, // Pass current watchlist to prevent duplicates
      },
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        this.movies.push(result.data); // Add selected movie to watchlist
      }
    });

    await modal.present();
  }
}
