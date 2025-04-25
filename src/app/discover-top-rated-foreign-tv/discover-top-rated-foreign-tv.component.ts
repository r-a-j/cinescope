import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from "@ionic/angular/standalone";
import { TvTopRatedModelResult } from 'src/models/tv/tv-top-rated.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-discover-top-rated-foreign-tv',
  templateUrl: './discover-top-rated-foreign-tv.component.html',
  styleUrls: ['./discover-top-rated-foreign-tv.component.scss'],
  imports: [
    IonButton,
    CommonModule
  ],
  standalone: true,
})
export class DiscoverTopRatedForeignTvComponent implements OnInit {
  topRatedTV: Partial<TvTopRatedModelResult>[] = [];

  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadTopRatedTv();
  }

  loadTopRatedTv(): void {
    this.tmdbService.getTopRatedTV(1).subscribe({
      next: (data) => {
        this.topRatedTV = data.results;
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
