import { Component, OnInit } from '@angular/core';
import { IonContent, IonButton, IonToolbar, IonSegmentButton, IonLabel, IonSegment, IonSkeletonText } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MovieSearchResult } from 'src/models/movie/movie-search.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { PersonResult } from 'src/models/person.model';
import { MovieTopRatedModelResult } from 'src/models/movie/movie-top-rated.model';
import { TvTopRatedModelResult } from 'src/models/tv/tv-top-rated.model';

interface MediaItem {
  id: number;
  title: string;
  rating?: number;
  year?: number;
  poster_path?: string;
}

@Component({
  selector: 'app-discover',
  templateUrl: 'discover.page.html',
  styleUrls: ['discover.page.scss'],
  imports: [IonSkeletonText, IonLabel, IonSegment, IonSegmentButton, IonToolbar,
    IonButton,
    CommonModule,
    FormsModule,
    IonContent,
    HeaderComponent
  ],
})
export class DiscoverPage implements OnInit {

  popularPersons: PersonResult[] = [];
  isLoadingPersons = true;

  // Near the existing properties
  desiTrendingMovies: MovieSearchResult[] = [];
  isLoading = true;

  // Default segment value
  segmentValue: string = 'bollywood';
  scrollTop: number = 0;

  // Demo data (with id added for navigation)
  // topRatedMovies: Partial<MovieTopRatedModelResult>[] = [
  //   { id: 1, poster_path: 'assets/placeholder.png'},
  //   { id: 2, poster_path: 'assets/placeholder.png'},
  //   { id: 3, poster_path: 'assets/placeholder.png'},
  //   { id: 4, poster_path: 'assets/placeholder.png'},
  //   { id: 5, poster_path: 'assets/placeholder.png'},
  // ];

  // topRatedTV: Partial<TvTopRatedModelResult>[] = [
  //   { id: 1, poster_path: 'assets/placeholder.png'},
  //   { id: 2, poster_path: 'assets/placeholder.png'},
  //   { id: 3, poster_path: 'assets/placeholder.png'},
  //   { id: 4, poster_path: 'assets/placeholder.png'},
  //   { id: 5, poster_path: 'assets/placeholder.png'},
  // ];

  topRatedMovies: Partial<MovieTopRatedModelResult>[] = [];
  topRatedTV: Partial<TvTopRatedModelResult>[] = [];

  // Demo banners (using unique ids)
  banners: { id: number; title: string; subtitle: string; imageUrl: string; }[] = [];

  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit(): void {
    this.loadDesiTrending();
    this.loadUpcomingBanners();
    this.loadPopularPersons();
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

  loadPopularPersons(): void {
    this.tmdbService.getPopularPersons(1).subscribe({
      next: (response) => {
        this.popularPersons = response.results;
        this.isLoadingPersons = false;
      },
      error: (error) => console.error(error)
    });
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

  // Generic list navigation for movies and TV shows
  navigateToList(category: 'movie' | 'tv'): void {
    const route = category === 'movie' ? '/top-rated-movies' : '/top-rated-tv';
    this.router.navigate([route]);
  }

  segmentChanged(event: any): void {
    this.segmentValue = event.detail.value;
    // Optionally add animations here if desired.
  }

  // For the Bollywood segment, combine movies and TV items.
  // getBollywoodCombined(): MediaItem[] {
  //   return [...this.topRatedMovies, ...this.topRatedTV];
  // }

  // Update scroll position for a possible parallax effect.
  onScroll(event: any): void {
    this.scrollTop = event.detail.scrollTop;
  }

  navigateToPersonDetail(id: number): void {
    this.router.navigate(['/person-detail', id]);
  }
}
