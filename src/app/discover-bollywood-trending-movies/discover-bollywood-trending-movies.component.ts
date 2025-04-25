import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MovieSearchResult } from 'src/models/movie/movie-search.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { IonButton } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-discover-bollywood-trending-movies',
  templateUrl: './discover-bollywood-trending-movies.component.html',
  styleUrls: ['./discover-bollywood-trending-movies.component.scss'],
  imports: [IonButton, CommonModule],
  standalone: true,
})
export class DiscoverBollywoodTrendingMoviesComponent  implements OnInit {

  desiTrendingMovies: MovieSearchResult[] = [];
  
  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadDesiTrending();
  }

  loadDesiTrending(): void {
    this.tmdbService.getTrendingBollywoodMovies(1).subscribe({
      next: (data) => {
        this.desiTrendingMovies = data.results;
      },
      error: (err) => console.error(err)
    });
  }

  navigateToDetail(category: 'movie' | 'tv', id: number | string): void {
    this.router.navigate([`/${category}-detail`, id]);
  }

  navigateToBollywoodTrending(): void {
    this.router.navigate(['/bollywood-trending']);
  }
}
