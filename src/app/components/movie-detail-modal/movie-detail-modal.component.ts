import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { IonContent, IonicModule, ModalController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Swiper } from 'swiper';
import { MovieDetails, RecommendationsResult, VideosResult } from 'src/app/models/movie-details.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-movie-detail-modal',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './movie-detail-modal.component.html',
  styleUrls: ['./movie-detail-modal.component.scss'],
})
export class MovieDetailModalComponent implements OnInit {
  @Input() movieId!: number;
  @ViewChild(IonContent) content!: IonContent;
  
  movie!: MovieDetails;
  selectedSegment: string = 'overview';
  slideOpts = { slidesPerView: 2.5, spaceBetween: 10 };

  constructor(private http: HttpClient,
    private modalCtrl: ModalController,
    private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    this.fetchMovieDetails();
  }

  fetchMovieDetails(): void {
    const url = `https://api.themoviedb.org/3/movie/${this.movieId}?append_to_response=videos,providers,recommendations,reviews&language=en-US`;
    const options = {
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0M2YzZDM0N2IxNzU2YmUyMjI1MGY4MGQ1ODAyOTEwMSIsIm5iZiI6MTczNjczNDg1Ny42OTIsInN1YiI6IjY3ODQ3ODg5MjI1NjAyM2RmZDRlNjAyNSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KfGGPJNVAJfMUKgZOkZvP44qJI_Id8ZtgnK-YFz1p4Q'
      }
    };

    this.http.get<MovieDetails>(url, options).subscribe({
      next: (data) => {
        if (data.release_date) {
          data.release_date = new Date(data.release_date);
        }

        if (data.reviews?.results) {
          data.reviews.results = data.reviews.results.map(review => ({
            ...review,
            created_at: new Date(review.created_at),
            updated_at: new Date(review.updated_at)
          }));
        }

        if (data.videos?.results) {
          data.videos.results = data.videos.results.map(video => ({
            ...video,
            published_at: new Date(video.published_at)
          }));
        }

        this.movie = data;
        console.log('Fetched movie:', this.movie);
        
        // Scroll to top after new data loads.
        this.content.scrollToTop(300);
      },
      error: (error) => {
        console.error('Error fetching movie details:', error);
      }
    });
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  getRuntimeFormatted(runtime: number | null | undefined): string {
    if (!runtime) return '';
    const hours = Math.floor(runtime / 60);
    const minutes = runtime % 60;
    return `${hours}h ${minutes}m`;
  }

  getTrailerUrl(): SafeResourceUrl {
    if (!this.movie?.videos?.results?.length) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }

    const trailer: VideosResult | undefined = this.movie.videos.results.find(
      (video) => video.site === 'YouTube' && video.type === 'Trailer'
    );

    if (trailer) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${trailer.key}`
      );
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
  }

  get topRecommendations() {
    return this.movie?.recommendations?.results?.slice(0, 6) || [];
  }

  get topSimilar() {
    return this.movie?.similar?.results?.slice(0, 6) || [];
  }

  get topCast() {
    return this.movie?.credits?.cast?.slice(0, 6) || [];
  }

  addToWatchlist(): void {
    this.modalCtrl.dismiss({ action: 'watchlist', movie: this.movie });
  }

  addToWatched(): void {
    this.modalCtrl.dismiss({ action: 'watched', movie: this.movie });
  }
  
  openRecommendedMovie(rec: RecommendationsResult): void {
    this.movieId = rec.id;    
    this.fetchMovieDetails();    
  }
}
