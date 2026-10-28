import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  untracked,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  ticketOutline,
  eyeOutline,
  playOutline,
  refreshOutline,
  star,
  timeOutline,
  sparkles
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import { TmdbMoviesService } from '../../../../core/services/tmdb-movies.service';
import { StorageService } from '../../../../core/services/storage.service';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';
import {
  StreamingAvailability,
  resolveStreamingDetails,
  getMovieTitle,
  getMoviePoster,
  getMovieYear,
  getMovieRating,
  getMovieRuntime,
  getMovieOverview,
  getMovieGenres
} from '../../movies.models';

@Component({
  selector: 'app-blind-ticket',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './blind-ticket.component.html',
  styleUrls: ['./blind-ticket.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlindTicketComponent {
  private tmdbMovies = inject(TmdbMoviesService);
  private storage = inject(StorageService);
  private providerCache = new Map<string, StreamingAvailability>();

  public watchlistMovies = input.required<ContentDocType[]>();
  public openDetail = output<number>();
  public watchTonight = output<ContentDocType>();

  public readonly isBlindTicketRevealed = signal<boolean>(false);
  public readonly blindTicketMovie = signal<ContentDocType | null>(null);
  public readonly isHolding = signal<boolean>(false);
  public readonly userRegion = computed<string>(() => {
    const reg = typeof this.storage.userRegion === 'function' ? this.storage.userRegion() : 'US';
    return (reg || 'US').toUpperCase();
  });
  public readonly streamingDetails = signal<StreamingAvailability>({
    region: 'US',
    type: 'none',
    providers: [],
    label: 'STREAMING',
    subtext: 'Loading availability...'
  });
  private holdTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    addIcons({
      ticketOutline,
      eyeOutline,
      playOutline,
      refreshOutline,
      star,
      timeOutline,
      sparkles
    });

    effect(() => {
      const movies = this.watchlistMovies();
      const current = untracked(() => this.blindTicketMovie());
      if (movies.length === 0) {
        this.blindTicketMovie.set(null);
        return;
      }
      if (!current || !movies.some(m => m.id === current.id)) {
        this.pickNextMysteryTicket();
      }
    });

    // Fetch watch providers for blind ticket movie in user's region
    effect(() => {
      const movie = this.blindTicketMovie();
      const region = this.userRegion();
      if (!movie) {
        this.streamingDetails.set({
          region,
          type: 'none',
          providers: [],
          label: `NOT STREAMING IN ${region}`,
          subtext: 'No movie selected'
        });
        return;
      }
      void this.loadWatchProviders(movie.tmdbId);
    });
  }

  public onHoldStart(): void {
    if (this.isBlindTicketRevealed()) return;
    this.isHolding.set(true);

    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
    }

    this.holdTimer = setTimeout(() => {
      this.tearBlindTicket();
      this.isHolding.set(false);
      this.holdTimer = null;
    }, 500);
  }

  public onHoldEnd(): void {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.isHolding.set(false);
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.repeat) return;
      this.onHoldStart();
    }
  }

  public onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      this.onHoldEnd();
    }
  }

  public tearBlindTicket(): void {
    if (this.isBlindTicketRevealed()) return;
    this.isBlindTicketRevealed.set(true);
  }

  public pickNextMysteryTicket(): void {
    const list = this.watchlistMovies();
    if (list.length === 0) return;

    const currentId = this.blindTicketMovie()?.id;
    const candidates = list.filter(m => m.id !== currentId);
    const pool = candidates.length > 0 ? candidates : list;
    const nextMovie = pool[Math.floor(Math.random() * pool.length)];

    this.isBlindTicketRevealed.set(false);
    this.blindTicketMovie.set(nextMovie);
  }

  private async loadWatchProviders(tmdbId: number): Promise<void> {
    const region = this.userRegion();
    const cacheKey = `${tmdbId}_${region}`;
    const cached = this.providerCache.get(cacheKey);
    if (cached) {
      this.streamingDetails.set(cached);
      return;
    }

    try {
      const resp = await firstValueFrom(this.tmdbMovies.getMovieWatchProviders(tmdbId));
      const details = resolveStreamingDetails(resp, region);
      this.providerCache.set(cacheKey, details);
      this.streamingDetails.set(details);
    } catch {
      const fallback: StreamingAvailability = {
        region,
        type: 'none',
        providers: [],
        label: `NOT STREAMING IN ${region}`,
        subtext: 'Availability information currently unavailable'
      };
      this.streamingDetails.set(fallback);
    }
  }

  public getProviderLogo(logoPath: string): string {
    return resolveMediaImageUrl(logoPath, 'w185');
  }

  // Model Helpers
  public getTitle(doc: ContentDocType | null): string {
    return getMovieTitle(doc);
  }
  public getPoster(doc: ContentDocType | null): string {
    return getMoviePoster(doc);
  }
  public getYear(doc: ContentDocType | null): string {
    return getMovieYear(doc);
  }
  public getRating(doc: ContentDocType | null): string {
    return getMovieRating(doc);
  }
  public getRuntime(doc: ContentDocType | null): string {
    return getMovieRuntime(doc);
  }
  public getOverview(doc: ContentDocType | null): string {
    return getMovieOverview(doc);
  }
  public getSealedOverview(doc: ContentDocType | null): string {
    const raw = getMovieOverview(doc);
    if (!raw) return '';
    if (this.isBlindTicketRevealed()) return raw;

    const title = getMovieTitle(doc).trim();
    if (!title || title === 'Untitled') return raw;

    const escaped = title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return raw.replace(regex, '██████');
  }
  public getGenres(doc: ContentDocType | null): string[] {
    return getMovieGenres(doc);
  }
}
