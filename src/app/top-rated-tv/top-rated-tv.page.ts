import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonInfiniteScroll, 
  IonInfiniteScrollContent, 
  IonSkeletonText, 
  IonButton, 
  IonButtons, 
  IonTitle, 
  IonToolbar, 
  IonHeader 
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { TvTopRatedModelResult } from 'src/models/tv/tv-top-rated.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-top-rated-tv',
  templateUrl: './top-rated-tv.page.html',
  styleUrls: ['./top-rated-tv.page.scss'],
  standalone: true,
  imports: [
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonButton, 
    IonSkeletonText, 
    IonInfiniteScrollContent, 
    IonInfiniteScroll,
    IonContent,
    CommonModule,
    FormsModule
  ],
})
export class TopRatedTvPage implements OnInit {
  tvList: Partial<TvTopRatedModelResult>[] = [];
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
    this.loadTv();
  }

  goToTvDetail(id: number | string) {
    this.router.navigate(['/tv-detail', id]);
  }

  loadTv(event?: any) {
    if (this.isLoading) return;

    this.isLoading = true;
    if (this.currentPage > 1) this.isPaginating = true;

    this.tmdbService.getTopRatedTV(this.currentPage).subscribe({
      next: (data) => {
        this.tvList.push(...data.results);
        this.totalPages = data.total_pages;
        this.currentPage++;

        this.isLoading = false;
        this.isPaginating = false;
        this.firstLoad = false;

        if (event) event.target.complete();
        if (this.currentPage > this.totalPages && event) event.target.disabled = true;
      },
      error: (err) => {
        console.error('Error loading TV:', err);
        this.isLoading = false;
        this.isPaginating = false;
        this.firstLoad = false;

        if (event) event.target.complete();
      }
    });
  }

  loadMore(event: any) {
    this.loadTv(event);
  }

  navigateToTopRated(): void {
    this.router.navigate(['tabs/discover']);
  }
}
