import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonIcon,
  IonButton,
  IonChip,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonTitle,
  IonLabel,
  IonSpinner
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  bookmark,
  star,
  calendarOutline,
  timeOutline,
  close,
  arrowBackOutline
} from 'ionicons/icons';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';
import { DomSanitizer } from '@angular/platform-browser';
import { NumberSuffixPipe } from "../../pipes/number-suffix.pipe";
import { ContentModel } from 'src/models/content.model';
import { BaseMediaDetailPage } from '../core/classes/base-media-detail.page';

@Component({
  selector: 'app-movie-detail',
  templateUrl: './movie-detail.page.html',
  styleUrls: ['./movie-detail.page.scss'],
  standalone: true,
  imports: [IonLabel,
    IonTitle,
    IonButtons,
    IonToolbar,
    IonHeader,
    IonChip,
    IonButton,
    IonIcon,
    IonContent,
    CommonModule,
    FormsModule,
    NumberSuffixPipe,
    IonSpinner],
})
export class MovieDetailPage extends BaseMediaDetailPage implements OnInit {
  readonly mediaType = 'movie';
  mediaId: number | null = null;
  movieDetail: MovieDetailModel | null = null;
  isVideoLoading: boolean = true;

  private route = inject(ActivatedRoute);
  private tmdbService = inject(TmdbSearchService);
  private sanitizer = inject(DomSanitizer);

  constructor() {
    super();
    addIcons({
      arrowBackOutline,
      bookmark,
      calendarOutline,
      timeOutline,
      star,
      close
    });
  }

  async ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;

    this.mediaId = +idParam;
    await this.loadMovieDetail(this.mediaId);
    await this.refreshBookmarkState();
  }

  onVideoLoad() {
    this.isVideoLoading = false;
  }

  async loadMovieDetail(id: number) {
    this.tmdbService.getMovieDetail(id).subscribe({
      next: (data) => {
        this.movieDetail = data;

        const trailer = data?.videos?.results?.find(
          (v) => v.type === 'Trailer' && v.site === 'YouTube'
        );
        const videoKey = trailer?.key || data?.videos?.results?.[0]?.key;

        if (videoKey) {
          this.safeYoutubeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoKey}`);
        }
      },
      error: (err) => {
        console.error('Failed to fetch movie detail', err);
      }
    });
  }

  createContentModel(): ContentModel {
    if (!this.movieDetail) throw new Error('Movie Detail not loaded');
    return {
      contentId: this.movieDetail.id!,
      isMovie: true,
      isTv: false,
      isWatched: false,
      isWatchlist: true,
      title: this.movieDetail.title,
      poster_path: this.movieDetail.poster_path,
      vote_average: this.movieDetail.vote_average,
      release_date: this.movieDetail.release_date,
      genres: this.movieDetail.genres
    };
  }
}