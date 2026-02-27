import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonLabel,
  IonChip,
  IonIcon,
  IonButtons,
  IonButton,
  IonThumbnail,
  IonCol,
  IonCard,
  IonRow,
  IonAccordionGroup,
  IonAccordion,
  IonItem
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { TvDetailModel } from 'src/models/tv/tv-detail.model';
import { DomSanitizer } from '@angular/platform-browser';
import { ContentModel } from 'src/models/content.model';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  bookmark,
  calendarOutline,
  star,
  timeOutline,
  close
} from 'ionicons/icons';
import { BaseMediaDetailPage } from '../core/classes/base-media-detail.page';

@Component({
  selector: 'app-tv-detail',
  templateUrl: './tv-detail.page.html',
  styleUrls: ['./tv-detail.page.scss'],
  standalone: true,
  imports: [
    IonItem,
    IonAccordion,
    IonAccordionGroup,
    IonRow,
    IonCard,
    IonCol,
    IonButton,
    IonButtons,
    IonIcon,
    IonChip,
    IonLabel,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonThumbnail
  ],
})
export class TvDetailPage extends BaseMediaDetailPage implements OnInit {
  readonly mediaType = 'tv';
  mediaId: number | null = null;
  tvDetail: TvDetailModel | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
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
    await this.loadTvDetail(this.mediaId);
    await this.refreshBookmarkState();
  }

  async loadTvDetail(id: number) {
    this.tmdbService.getTvDetail(id).subscribe({
      next: (data) => {
        this.tvDetail = data;
        const trailer = data?.videos?.results?.find(
          (v) => v.type === 'Trailer' && v.site === 'YouTube'
        );
        const videoKey = trailer?.key || data?.videos?.results?.[0]?.key;

        if (videoKey) {
          this.safeYoutubeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoKey}`);
        }
      },
      error: (err) => {
        console.error('Failed to fetch tv detail', err);
      }
    });
  }

  createContentModel(): ContentModel {
    if (!this.tvDetail) throw new Error('TV Detail not loaded');
    return {
      contentId: this.tvDetail.id!,
      isMovie: false,
      isTv: true,
      isWatched: false,
      isWatchlist: true,
      name: this.tvDetail.name,
      poster_path: this.tvDetail.poster_path,
      vote_average: this.tvDetail.vote_average,
      first_air_date: this.tvDetail.first_air_date,
      genres: this.tvDetail.genres
    };
  }

  navigateToDetail(category: 'movie' | 'tv', id: number | string): void {
    this.router.navigate([`/${category}-detail`, id]);
  }
}
