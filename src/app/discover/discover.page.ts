import { Component } from '@angular/core';
import { IonContent, IonButton } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-discover',
  templateUrl: 'discover.page.html',
  styleUrls: ['discover.page.scss'],
  imports: [
    IonButton,
    CommonModule,
    FormsModule,
    IonContent,
    HeaderComponent
  ],
})
export class DiscoverPage {
  // Demo data
  topRatedMovies = [
    { title: 'Breaking Bad', rating: 8.9, year: 2008 },
    { title: 'The Apothecary Diaries', rating: 8.8, year: 2023 },
    { title: 'Adventure Time: Fionna & Cake', rating: 8.8, year: 2023 },
    { title: 'Arcane', rating: 8.9, year: 2021 },
    { title: 'Avatar: The Last Airbender', rating: 9.2, year: 2005 },
  ];

  topRatedTV = [
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'Hazbin Hotel', rating: 8.8, year: 2023 },
    { title: 'Freiren: Beyond Journey’s End', rating: 8.8, year: 2023 },
    { title: 'Dan Da Dan', rating: 8.6, year: 2024 },
  ];

  constructor(private router: Router) {}

  goToAllMovies() {
    this.router.navigate(['/top-rated-movies']);
  }

  goToAllTV() {
    this.router.navigate(['/top-rated-tv']);
  }

  goToTvDetail(id: number | string) {
    this.router.navigate(['/tv-detail', id]);
  }

  goToMovieDetail(id: number | string) {
    this.router.navigate(['/movie-detail', id]);
  }
}
