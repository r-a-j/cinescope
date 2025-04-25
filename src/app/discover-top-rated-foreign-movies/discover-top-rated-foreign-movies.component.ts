import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from "@ionic/angular/standalone";
import { MovieTopRatedModelResult } from 'src/models/movie/movie-top-rated.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-discover-top-rated-foreign-movies',
  templateUrl: './discover-top-rated-foreign-movies.component.html',
  styleUrls: ['./discover-top-rated-foreign-movies.component.scss'],
  imports: [IonButton, CommonModule],
  standalone: true,
})
export class DiscoverTopRatedForeignMoviesComponent implements OnInit {
  topRatedMovies: Partial<MovieTopRatedModelResult>[] = [];

  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadTopRatedMovies();
  }

  loadTopRatedMovies(): void {
    this.tmdbService.getTopRatedMovies(1).subscribe({
      next: (data) => {
        this.topRatedMovies = data.results;
      },
      error: (err) => console.error(err)
    });
  }

  navigateToList(category: 'movie' | 'tv'): void {
    const route = category === 'movie' ? '/top-rated-movies' : '/top-rated-tv';
    this.router.navigate([route]);
  }

  navigateToDetail(category: 'movie' | 'tv', id: number | string): void {
    this.router.navigate([`/${category}-detail`, id]);
  }
}
