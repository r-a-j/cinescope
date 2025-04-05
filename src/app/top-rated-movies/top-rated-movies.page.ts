import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-top-rated-movies',
  templateUrl: './top-rated-movies.page.html',
  styleUrls: ['./top-rated-movies.page.scss'],
  standalone: true,
  imports: [
    IonContent, 
    CommonModule, 
    FormsModule, 
    HeaderComponent
  ],
})
export class TopRatedMoviesPage implements OnInit {

  // Placeholder for a larger grid or list
  movies = [
    { title: 'Breaking Bad', rating: 8.9, year: 2008 },
    { title: 'The Apothecary Diaries', rating: 8.8, year: 2023 },
    // Add more data as needed
  ];

  constructor(private router: Router) { }

  ngOnInit() {
  }

  goToMovieDetail(id: number | string) {
    this.router.navigate(['/movie-detail', id]);
  }

}
