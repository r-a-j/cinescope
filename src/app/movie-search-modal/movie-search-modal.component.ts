import { Component, Input } from '@angular/core';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar } from "@ionic/angular/standalone";

@Component({
  selector: 'app-movie-search-modal',
  standalone: true,
  imports: [IonToolbar, IonHeader, CommonModule, FormsModule, IonicModule],
  templateUrl: './movie-search-modal.component.html',
  styleUrls: ['./movie-search-modal.component.scss'],
})
export class MovieSearchModalComponent {
  @Input() watchlist: { title: string; poster: string }[] = []; // Receive existing watchlist
  searchQuery: string = '';

  // Mock API Movies Data (Pretend these are fetched dynamically)
  apiMovies = [
    { title: 'Inception', poster: 'assets/inception.jpg' },
    { title: 'Breaking Bad', poster: 'assets/breaking_bad.jpg' },
    { title: 'Stranger Things', poster: 'assets/stranger_things.jpg' },
    { title: 'Dark', poster: 'assets/dark.jpg' },
    { title: 'Interstellar', poster: 'assets/interstellar.jpg' },
    { title: 'The Batman', poster: 'assets/the_batman.jpg' },
    { title: 'Dune', poster: 'assets/dune.jpg' },
  ];

  filteredMovies: { title: string; poster: string }[] = [];

  constructor(
    private modalController: ModalController,
    private toastController: ToastController
  ) { }

  dismiss() {
    this.modalController.dismiss();
  }

  // Simulate API Search
  searchMovies() {
    if (this.searchQuery.trim() === '') {
      this.filteredMovies = []; // Reset if search query is empty
      return;
    }

    setTimeout(() => {
      this.filteredMovies = this.apiMovies.filter(
        (movie) =>
          movie.title.toLowerCase().includes(this.searchQuery.toLowerCase()) &&
          !this.watchlist.some((w) => w.title === movie.title) // Prevent showing already added movies
      );
    }, 500); // Mock API response delay
  }

  async addMovie(movie: { title: string; poster: string }) {
    if (this.watchlist.some((w) => w.title === movie.title)) {
      // Show toast if movie is already in watchlist
      const toast = await this.toastController.create({
        message: `${movie.title} is already in your Watchlist.`,
        duration: 2000,
        color: 'warning',
      });
      await toast.present();
    } else {
      this.modalController.dismiss(movie); // Return selected movie to parent component
      const toast = await this.toastController.create({
        message: `${movie.title} added to Watchlist!`,
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }

    // Remove the added movie from the search list
    this.filteredMovies = this.filteredMovies.filter((m) => m.title !== movie.title);
  }
}
