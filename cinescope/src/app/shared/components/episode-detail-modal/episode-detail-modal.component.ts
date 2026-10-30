import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonModal,
  IonContent,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  closeOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  timeOutline,
  calendarOutline,
  star,
  chevronBack,
  chevronForward,
  chevronBackOutline,
  chevronForwardOutline,
  playCircleOutline,
  openOutline,
  filmOutline,
  peopleOutline,
  ribbonOutline,
  arrowForwardOutline,
  tvOutline,
  videocamOutline,
  createOutline
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { TmdbTvEpisodesService } from '../../../core/services/tmdb-tv-episodes.service';
import { TvProgressService } from '../../../core/services/tv-progress.service';
import { ToastService } from '../../../core/services/toast.service';
import { PosterCacheService } from '../../../core/services/poster-cache.service';
import { DEFAULT_POSTER_PLACEHOLDER, resolveMediaImageUrl } from '../../../core/constants/api.constants';
import { TmdbTvEpisodeDetailDto } from '../../../core/dtos/tv-episodes/tv-episode-detail.dto';
import { TmdbTvSeasonGuestStarDto } from '../../../core/dtos/tv-seasons/tv-season-detail.dto';
import { TmdbTvCrewDto } from '../../../core/dtos/tv/tv-credits.dto';
import { TmdbVideoDto } from '../../../core/dtos/common/video.dto';

@Component({
  selector: 'app-episode-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonModal,
    IonContent,
    IonIcon,
    IonSpinner
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './episode-detail-modal.component.html',
  styleUrls: ['./episode-detail-modal.component.scss']
})
export class EpisodeDetailModalComponent {
  private readonly episodesService = inject(TmdbTvEpisodesService);
  private readonly tvProgress = inject(TvProgressService);
  private readonly toast = inject(ToastService);
  private readonly posterCache = inject(PosterCacheService);
  private readonly router = inject(Router);

  // Inputs
  public readonly isOpen = input<boolean>(false);
  public readonly seriesId = input<number | undefined>(undefined);
  public readonly seasonNumber = input<number>(1);
  public readonly episodeNumber = input<number>(1);
  public readonly seriesTitle = input<string | undefined>(undefined);
  public readonly seriesBackdropUrl = input<string | null | undefined>(undefined);
  public readonly totalEpisodesInSeason = input<number | undefined>(undefined);

  // Outputs
  public readonly didDismiss = output();
  public readonly episodeChange = output<{ seasonNumber: number; episodeNumber: number }>();
  public readonly watchedToggle = output<{ seasonNumber: number; episodeNumber: number; isWatched: boolean }>();

  // State
  public readonly isLoading = signal<boolean>(false);
  public readonly error = signal<string | null>(null);
  public readonly detail = signal<TmdbTvEpisodeDetailDto | null>(null);
  public readonly currentSeasonNumber = signal<number>(1);
  public readonly currentEpisodeNumber = signal<number>(1);

  // Computed Values
  public readonly isWatched = computed<boolean>(() => {
    const id = this.seriesId();
    if (!id) return false;
    return this.tvProgress.isEpisodeWatched(id, this.currentSeasonNumber(), this.currentEpisodeNumber());
  });

  public readonly episodeCode = computed<string>(() => {
    return `S${this.currentSeasonNumber()} • E${this.currentEpisodeNumber()}`;
  });

  public readonly stillUrl = computed<string>(() => {
    const d = this.detail();
    if (d?.still_path) {
      return resolveMediaImageUrl(d.still_path, 'w780');
    }
    return this.seriesBackdropUrl() || DEFAULT_POSTER_PLACEHOLDER;
  });

  public readonly formattedAirDate = computed<string | null>(() => {
    const dateStr = this.detail()?.air_date;
    if (!dateStr) return null;
    try {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return dateStr;
      return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  });

  public readonly formattedRuntime = computed<string | null>(() => {
    const rt = this.detail()?.runtime;
    if (!rt || rt <= 0) return null;
    return `${rt} min`;
  });

  public readonly ratingFormatted = computed<string | null>(() => {
    const v = this.detail()?.vote_average;
    if (!v || v <= 0) return null;
    return v.toFixed(1);
  });

  public readonly voteCountFormatted = computed<string>(() => {
    const cnt = this.detail()?.vote_count;
    if (!cnt || cnt <= 0) return '';
    return cnt.toLocaleString();
  });

  public readonly episodeTypeLabel = computed<string | null>(() => {
    const t = this.detail()?.episode_type;
    if (!t || t === 'standard') return null;
    if (t === 'finale') return 'Season Finale';
    if (t === 'mid_season') return 'Mid-Season Finale';
    return t.replace(/_/g, ' ').toUpperCase();
  });

  public readonly isFinale = computed<boolean>(() => {
    return this.detail()?.episode_type === 'finale';
  });

  public readonly directors = computed<TmdbTvCrewDto[]>(() => {
    const crew = this.detail()?.crew;
    if (!crew || !Array.isArray(crew)) return [];
    const dirs = crew.filter((c) => c.job === 'Director' || c.department === 'Directing');
    const seen = new Set<string>();
    return dirs.filter((d) => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });
  });

  public readonly writers = computed<TmdbTvCrewDto[]>(() => {
    const crew = this.detail()?.crew;
    if (!crew || !Array.isArray(crew)) return [];
    const w = crew.filter(
      (c) => c.job === 'Writer' || c.job === 'Screenplay' || c.department === 'Writing'
    );
    const seen = new Set<string>();
    return w.filter((writer) => {
      if (seen.has(writer.name)) return false;
      seen.add(writer.name);
      return true;
    });
  });

  public readonly guestStars = computed<TmdbTvSeasonGuestStarDto[]>(() => {
    const d = this.detail();
    const list = d?.guest_stars || (d?.credits as { guest_stars?: TmdbTvSeasonGuestStarDto[] } | undefined)?.guest_stars;
    if (!list || !Array.isArray(list)) return [];
    return list.slice(0, 12);
  });

  public readonly promoVideos = computed<TmdbVideoDto[]>(() => {
    const videos = this.detail()?.videos?.results;
    if (!videos || !Array.isArray(videos)) return [];
    return videos.filter(
      (v) => v.site === 'YouTube' && (v.type === 'Promo' || v.type === 'Teaser' || v.type === 'Trailer')
    );
  });

  public readonly imdbUrl = computed<string | null>(() => {
    const imdbId = (this.detail()?.external_ids as { imdb_id?: string | null } | undefined)?.imdb_id;
    if (!imdbId) return null;
    return `https://www.imdb.com/title/${imdbId}/`;
  });

  public readonly canGoPrev = computed<boolean>(() => {
    return this.currentEpisodeNumber() > 1;
  });

  public readonly canGoNext = computed<boolean>(() => {
    const total = this.totalEpisodesInSeason();
    if (total && total > 0) {
      return this.currentEpisodeNumber() < total;
    }
    return true;
  });

  constructor() {
    addIcons({
      close,
      closeOutline,
      checkmarkCircle,
      checkmarkCircleOutline,
      timeOutline,
      calendarOutline,
      star,
      chevronBack,
      chevronForward,
      chevronBackOutline,
      chevronForwardOutline,
      playCircleOutline,
      openOutline,
      filmOutline,
      peopleOutline,
      ribbonOutline,
      arrowForwardOutline,
      tvOutline,
      videocamOutline,
      createOutline
    });

    effect((onCleanup) => {
      const open = this.isOpen();
      const sId = this.seriesId();
      const sNum = this.seasonNumber();
      const eNum = this.episodeNumber();

      if (open) {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        onCleanup(() => {
          document.body.style.overflow = prevOverflow;
        });
      }

      if (open && sId) {
        this.currentSeasonNumber.set(sNum || 1);
        this.currentEpisodeNumber.set(eNum || 1);
        void this.loadEpisode(sId, sNum || 1, eNum || 1);
      }
    });
  }

  public async loadEpisode(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.episodesService.getTvEpisodeDetails(
          seriesId,
          seasonNumber,
          episodeNumber,
          'credits,videos,external_ids,images'
        )
      );

      this.detail.set(res);

      if (res?.still_path) {
        this.posterCache.prewarmUrls([resolveMediaImageUrl(res.still_path, 'w780')]);
      }
    } catch (err) {
      console.warn(`[EpisodeDetailModal] Failed to load S${seasonNumber} E${episodeNumber}:`, err);
      this.error.set('Episode details could not be loaded at this time.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public closeModal(): void {
    this.didDismiss.emit();
  }

  public async toggleWatched(): Promise<void> {
    const id = this.seriesId();
    if (!id) return;

    const season = this.currentSeasonNumber();
    const ep = this.currentEpisodeNumber();
    const title = this.seriesTitle() || this.detail()?.name || 'Show';

    const nowWatched = await this.tvProgress.toggleEpisode(id, season, ep, {
      title
    });

    this.watchedToggle.emit({
      seasonNumber: season,
      episodeNumber: ep,
      isWatched: nowWatched
    });

    if (nowWatched) {
      await this.toast.presentSuccess(`Marked S${season} E${ep} watched`, 1800);
    } else {
      await this.toast.presentWarning(`Unmarked S${season} E${ep}`, 1800);
    }
  }

  public goToPrevEpisode(): void {
    const sId = this.seriesId();
    if (!this.canGoPrev() || !sId) return;

    const nextEp = this.currentEpisodeNumber() - 1;
    this.currentEpisodeNumber.set(nextEp);

    this.episodeChange.emit({
      seasonNumber: this.currentSeasonNumber(),
      episodeNumber: nextEp
    });

    void this.loadEpisode(sId, this.currentSeasonNumber(), nextEp);
  }

  public goToNextEpisode(): void {
    const sId = this.seriesId();
    if (!this.canGoNext() || !sId) return;

    const nextEp = this.currentEpisodeNumber() + 1;
    this.currentEpisodeNumber.set(nextEp);

    this.episodeChange.emit({
      seasonNumber: this.currentSeasonNumber(),
      episodeNumber: nextEp
    });

    void this.loadEpisode(sId, this.currentSeasonNumber(), nextEp);
  }

  public openFullSeriesPage(): void {
    const id = this.seriesId();
    this.closeModal();
    if (id) {
      void this.router.navigate(['/media', 'tv', id]);
    }
  }

  public openImdbTrivia(): void {
    const url = this.imdbUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  public openVideo(videoKey: string): void {
    if (videoKey) {
      window.open(`https://www.youtube.com/watch?v=${videoKey}`, '_blank', 'noopener,noreferrer');
    }
  }

  public resolveProfile(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w185', 'assets/placeholders/placeholder.webp');
  }

  public onStillError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const fallback = this.seriesBackdropUrl();
    if (fallback && img.src !== fallback) {
      img.src = fallback;
    } else {
      img.src = DEFAULT_POSTER_PLACEHOLDER;
    }
  }
}
