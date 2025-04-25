import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from "@ionic/angular/standalone";
import { MovieTopRatedModelResult } from 'src/models/movie/movie-top-rated.model';
import { TvTopRatedModelResult } from 'src/models/tv/tv-top-rated.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-discover-top-rated',
  templateUrl: './discover-top-rated.component.html',
  styleUrls: ['./discover-top-rated.component.scss'],
  imports: [IonButton, CommonModule],
  standalone: true,
})
export class DiscoverTopRatedComponent implements OnInit {

  topRatedMovies: Partial<MovieTopRatedModelResult>[] = [];
  topRatedTV: Partial<TvTopRatedModelResult>[] = [];

  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadTopRatedMovies();
    this.loadTopRatedTv();
  }

  loadTopRatedMovies(): void {
    this.tmdbService.getTopRatedMovies(1).subscribe({
      next: (data) => {
        this.topRatedMovies = data.results;
      },
      error: (err) => console.error(err)
    });
  }

  loadTopRatedTv(): void {
    this.tmdbService.getTopRatedTV(1).subscribe({
      next: (data) => {
        this.topRatedTV = data.results;
      },
      error: (err) => console.error(err)
    });
  }

  // Generic list navigation for movies and TV shows
  navigateToList(category: 'movie' | 'tv'): void {
    const route = category === 'movie' ? '/top-rated-movies' : '/top-rated-tv';
    this.router.navigate([route]);
  }

  // Generic detail navigation for movies and TV shows
  navigateToDetail(category: 'movie' | 'tv', id: number | string): void {
    this.router.navigate([`/${category}-detail`, id]);
  }

}
