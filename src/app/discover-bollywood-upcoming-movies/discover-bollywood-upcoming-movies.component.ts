import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonSkeletonText } from "@ionic/angular/standalone";
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-discover-bollywood-upcoming-movies',
  templateUrl: './discover-bollywood-upcoming-movies.component.html',
  styleUrls: ['./discover-bollywood-upcoming-movies.component.scss'],
  imports: [IonSkeletonText, CommonModule],
  standalone: true,
})
export class DiscoverBollywoodUpcomingMoviesComponent  implements OnInit {

  isLoading = true;
  banners: { id: number; title: string; subtitle: string; imageUrl: string; }[] = [];


  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadUpcomingBanners();
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
}
