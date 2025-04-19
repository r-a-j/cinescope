import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonInfiniteScroll, IonInfiniteScrollContent, IonButtons, IonButton } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MovieSearchResult } from 'src/models/movie/movie-search.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-bollywood-trending',
  templateUrl: './bollywood-trending.page.html',
  styleUrls: ['./bollywood-trending.page.scss'],
  standalone: true,
  imports: [IonButton, IonButtons, IonInfiniteScrollContent, IonInfiniteScroll, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class BollywoodTrendingPage implements OnInit {

  movies: MovieSearchResult[] = [];
  currentPage: number = 1;
  totalPages: number = 1;

  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit(): void {
    this.loadMovies();
  }

  navigateToDiscover(): void {
    this.router.navigate(['tabs/discover']);
  }

  loadMovies(event?: any): void {
    this.tmdbService.getTrendingBollywoodMovies(this.currentPage).subscribe({
      next: (response) => {
        this.movies = [...this.movies, ...response.results];
        this.totalPages = response.total_pages;
        this.currentPage++;
        if (event) {
          event.target.complete();
          if (this.currentPage > this.totalPages) {
            event.target.disabled = true;
          }
        }
      },
      error: (error) => {
        console.error('Error fetching movies:', error);
        if (event) {
          event.target.complete();
        }
      }
    });
  }

  loadMore(event: any): void {
    if (this.currentPage > this.totalPages) {
      event.target.disabled = true;
      return;
    }
    this.loadMovies(event);
  }

  // Method to navigate to the movie detail page using the movie id
  navigateToDetail(category: 'movie' | 'tv', id: number | string): void {
    if (category === 'movie') {
      this.router.navigate(['/movie-detail', id]);
    } else {
      this.router.navigate(['/tv-detail', id]);
    }
  }
}
