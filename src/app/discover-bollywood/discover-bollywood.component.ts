import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonSkeletonText, IonButton } from "@ionic/angular/standalone";
import { MovieSearchResult } from 'src/models/movie/movie-search.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-discover-bollywood',
  templateUrl: './discover-bollywood.component.html',
  styleUrls: ['./discover-bollywood.component.scss'],
  imports: [IonSkeletonText, IonButton, CommonModule],
  standalone: true,
})
export class DiscoverBollywoodComponent implements OnInit {

  desiTrendingMovies: MovieSearchResult[] = [];
  isLoading = true;
  banners: { id: number; title: string; subtitle: string; imageUrl: string; }[] = [];


  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadDesiTrending();
    this.loadUpcomingBanners();
  }

  loadDesiTrending(): void {
    this.tmdbService.getTrendingBollywoodMovies(1).subscribe({
      next: (data) => {
        this.desiTrendingMovies = data.results;
      },
      error: (err) => console.error(err)
    });
  }

  // In discover.page.ts or your appropriate component
  loadUpcomingBanners(): void {
    this.tmdbService.getUpcomingMovies(1).subscribe({
      next: (response) => {
        this.banners = response.results.map(movie => ({
          id: movie.id,
          title: movie.title,
          subtitle: `${movie.release_date}`,
          imageUrl: movie.backdrop_path
            ? 'https://image.tmdb.org/t/p/w500' + movie.backdrop_path
            : 'assets/placeholder-backdrop.png'
        }));
        this.isLoading = false;
      },
      error: (error) => console.error(error)
    });
  }

  // Generic detail navigation for movies and TV shows
  navigateToDetail(category: 'movie' | 'tv', id: number | string): void {
    this.router.navigate([`/${category}-detail`, id]);
  }

  navigateToBollywoodTrending(): void {
    this.router.navigate(['/bollywood-trending']);
  }

}
