import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { IonContent, IonicModule, ModalController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Swiper } from 'swiper';
import { MovieDetails, RecommendationsResult, VideosResult } from 'src/app/models/movie-details.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MovieService } from 'src/app/services/movie.service';

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

  constructor(
    private movieService: MovieService,
    private modalCtrl: ModalController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.fetchMovieDetails();
  }

  /**
   * Retrieves movie details using the MovieService.
   */
  fetchMovieDetails(): void {
    this.movieService.getMovieDetails(this.movieId).subscribe({
      next: (data: MovieDetails) => { // Explicitly type the data as MovieDetails
        if (data.release_date) {
          data.release_date = new Date(data.release_date);
        }

        // Assuming you have a type for reviews, e.g., Review. If not, use a more specific type than any.
        if (data.reviews?.results) {
          data.reviews.results = data.reviews.results.map((review: any): any => ({
            ...review,
            created_at: new Date(review.created_at),
            updated_at: new Date(review.updated_at)
          }));
        }

        // Explicitly type each video item. If VideosResult is defined, use that type.
        if (data.videos?.results) {
          data.videos.results = data.videos.results.map((video: any): VideosResult => ({
            ...video,
            published_at: new Date(video.published_at)
          }));
        }

        this.movie = data;
        this.content.scrollToTop(300);
      },
      error: (error: any) => { // Explicitly type the error parameter
        console.error('Error fetching movie details:', error);
      }
    });
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  /**
   * Formats runtime (in minutes) to "Xh Ym".
   * @param runtime The runtime in minutes.
   * @returns Formatted runtime string.
   */
  getRuntimeFormatted(runtime: number | null | undefined): string {
    if (!runtime) return '';
    const hours = Math.floor(runtime / 60);
    const minutes = runtime % 60;
    return `${hours}h ${minutes}m`;
  }

  /**
   * Generates a safe URL for embedding the movie trailer from YouTube.
   * @returns A safe resource URL.
   */
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

  /**
   * Returns the top 6 recommended movies.
   */
  get topRecommendations() {
    return this.movie?.recommendations?.results?.slice(0, 6) || [];
  }

  /**
   * Returns the top 6 similar movies.
   */
  get topSimilar() {
    return this.movie?.similar?.results?.slice(0, 6) || [];
  }

  /**
   * Returns the top 6 cast members.
   */
  get topCast() {
    return this.movie?.credits?.cast?.slice(0, 6) || [];
  }

  /**
   * Dismisses the modal and passes the movie to be added to the watchlist.
   */
  addToWatchlist(): void {
    this.modalCtrl.dismiss({ action: 'watchlist', movie: this.movie });
  }

  /**
   * Dismisses the modal and passes the movie to be added to the watched list.
   */
  addToWatched(): void {
    this.modalCtrl.dismiss({ action: 'watched', movie: this.movie });
  }

  /**
   * Opens details for a recommended movie.
   * @param rec The recommended movie.
   */
  openRecommendedMovie(rec: RecommendationsResult): void {
    this.movieId = rec.id;
    this.fetchMovieDetails();
  }
}
