import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonInfiniteScroll, 
  IonInfiniteScrollContent, 
  IonSkeletonText, 
  IonHeader, 
  IonToolbar, 
  IonButtons, 
  IonTitle, 
  IonButton 
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { MovieTopRatedModelResult } from 'src/models/movie/movie-top-rated.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-top-rated-movies',
  templateUrl: './top-rated-movies.page.html',
  styleUrls: ['./top-rated-movies.page.scss'],
  standalone: true,
  imports: [
    IonButton, 
    IonTitle, 
    IonButtons, 
    IonToolbar, 
    IonHeader, 
    IonSkeletonText, 
    IonInfiniteScrollContent, 
    IonInfiniteScroll,
    IonContent,
    CommonModule,
    FormsModule
  ],
})
export class TopRatedMoviesPage implements OnInit {
  movieList: Partial<MovieTopRatedModelResult>[] = [];
  currentPage = 1;
  totalPages = 0;
  isLoading = false;
  firstLoad = true;
  isPaginating = false;

  constructor(
    private router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadMovies();
  }

  goToMovieDetail(id: number | string) {
    this.router.navigate(['/movie-detail', id]);
  }

  loadMovies(event?: any) {
    if (this.isLoading) return;

    this.isLoading = true;
    if (this.currentPage > 1) this.isPaginating = true;

    this.tmdbService.getTopRatedMovies(this.currentPage).subscribe({
      next: (data) => {
        this.movieList.push(...data.results);
        this.totalPages = data.total_pages;
        this.currentPage++;

        this.isLoading = false;
        this.isPaginating = false;
        this.firstLoad = false;

        if (event) event.target.complete();
        if (this.currentPage > this.totalPages && event) event.target.disabled = true;
      },
      error: (err) => {
        console.error('Error loading movies:', err);
        this.isLoading = false;
        this.isPaginating = false;
        this.firstLoad = false;

        if (event) event.target.complete();
      }
    });
  }

  loadMore(event: any) {
    this.loadMovies(event);
  }

  navigateToTopRated(): void {
    this.router.navigate(['tabs/discover']);
  }
}
