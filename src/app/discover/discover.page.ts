import { Component, OnInit } from '@angular/core';
import { IonContent, IonButton, IonToolbar, IonSegmentButton, IonLabel, IonSegment, IonSkeletonText } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MovieSearchResult } from 'src/models/movie/movie-search.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { PersonResult } from 'src/models/person.model';

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
  topRatedMovies: MediaItem[] = [
    { id: 1, title: 'Breaking Bad', rating: 8.9, year: 2008 },
    { id: 2, title: 'The Apothecary Diaries', rating: 8.8, year: 2023 },
    { id: 3, title: 'Adventure Time: Fionna & Cake', rating: 8.8, year: 2023 },
    { id: 4, title: 'Arcane', rating: 8.9, year: 2021 },
    { id: 5, title: 'Avatar: The Last Airbender', rating: 9.2, year: 2005 },
  ];

  topRatedTV: MediaItem[] = [
    { id: 6, title: 'One Piece', rating: 8.8, year: 1999 },
    { id: 7, title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { id: 8, title: 'Hazbin Hotel', rating: 8.8, year: 2023 },
    { id: 9, title: 'Freiren: Beyond Journey’s End', rating: 8.8, year: 2023 },
    { id: 10, title: 'Dan Da Dan', rating: 8.6, year: 2024 },
  ];

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
  getBollywoodCombined(): MediaItem[] {
    return [...this.topRatedMovies, ...this.topRatedTV];
  }

  // Update scroll position for a possible parallax effect.
  onScroll(event: any): void {
    this.scrollTop = event.detail.scrollTop;
  }

  navigateToPersonDetail(id: number): void {
    this.router.navigate(['/person-detail', id]);
  }
}
