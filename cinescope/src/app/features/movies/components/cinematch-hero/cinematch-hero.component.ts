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
  diceOutline,
  shuffleOutline,
  sparkles,
  playOutline,
  checkmarkCircle,
  timeOutline,
  filmOutline,
  star,
  flameOutline,
  bookmark,
  sunnyOutline,
  moonOutline,
  tvOutline,
  informationCircleOutline,
  globeOutline,
  pricetagOutline
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { firstValueFrom } from 'rxjs';

import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import { TmdbMoviesService } from '../../../../core/services/tmdb-movies.service';
import { StorageService } from '../../../../core/services/storage.service';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';

import {
  CineMatchMood,
  MoodFilterOption,
  TimeOfDayGreeting,
  ContextualHook,
  StreamingAvailability,
  getTimeOfDayGreeting,
  getContextualHook,
  resolveStreamingDetails,
  getMovieTitle,
  getMoviePoster,
  getMovieBackdrop,
  getMovieYear,
  getMovieRating,
  getMovieRuntime,
  getAddedTimeAgo,
  getMovieOverview,
  getMovieGenres
} from '../../movies.models';

@Component({
  selector: 'app-cinematch-hero',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './cinematch-hero.component.html',
  styleUrls: ['./cinematch-hero.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CinematchHeroComponent {
  private tmdbMovies = inject(TmdbMoviesService);
  private storage = inject(StorageService);

  public watchlistMovies = input.required<ContentDocType[]>();

  public openDetail = output<number>();
  public discoverClick = output();
  public toggleBookmark = output<ContentDocType>();
  public markWatched = output<ContentDocType>();

  public readonly activeMood = signal<CineMatchMood>('all');
  public readonly selectedMovie = signal<ContentDocType | null>(null);
  public readonly isShuffling = signal<boolean>(false);
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

  // Time of Day Greeting
  public readonly greeting = computed<TimeOfDayGreeting>(() => getTimeOfDayGreeting());

  public readonly baseMoodOptions: MoodFilterOption[] = [
    { id: 'all', label: 'Any Mood', icon: 'shuffle-outline' },
    { id: 'quick', label: '< 95 Mins', icon: 'time-outline' },
    { id: 'mind_bending', label: 'Mind-Bending', icon: 'sparkles' },
    { id: 'adrenaline', label: 'Adrenaline', icon: 'flame-outline' },
    { id: 'popcorn', label: 'Popcorn Fun', icon: 'film-outline' },
    { id: 'cozy', label: 'Cozy & Drama', icon: 'film-outline' },
    { id: 'acclaimed', label: 'Critically Acclaimed (★ 8+)', icon: 'star' }
  ];

  // Whichever category has 0 movies in the watchlist is shifted to the end
  public readonly sortedMoodOptions = computed<MoodFilterOption[]>(() => {
    const counts = this.moodCounts();
    const withMovies: MoodFilterOption[] = [];
    const withoutMovies: MoodFilterOption[] = [];

    for (const option of this.baseMoodOptions) {
      if ((counts[option.id] || 0) > 0) {
        withMovies.push(option);
      } else {
        withoutMovies.push(option);
      }
    }

    return [...withMovies, ...withoutMovies];
  });

  public get moodOptions(): MoodFilterOption[] {
    return this.sortedMoodOptions();
  }

  // Dynamic Mood Counts from Watchlist
  public readonly moodCounts = computed<Record<CineMatchMood, number>>(() => {
    const list = this.watchlistMovies();
    const counts: Record<CineMatchMood, number> = {
      all: list.length,
      quick: 0,
      mind_bending: 0,
      adrenaline: 0,
      popcorn: 0,
      cozy: 0,
      acclaimed: 0
    };

    for (const item of list) {
      const p = item.payload as Record<string, unknown> | undefined;
      if (!p) continue;

      const runtime = Number(p['runtime'] || 0);
      const rating = Number(p['vote_average'] || 0);

      let genreIds: number[] = [];
      if (Array.isArray(p['genre_ids'])) {
        genreIds = p['genre_ids'].map(Number);
      } else if (Array.isArray(p['genres'])) {
        genreIds = (p['genres'] as (Record<string, unknown> | number)[]).map(g =>
          typeof g === 'object' && g !== null ? Number(g['id'] || 0) : Number(g)
        );
      }

      if (runtime > 0 && runtime <= 95) counts.quick++;
      if (genreIds.some(id => [9648, 878, 53].includes(id))) counts.mind_bending++;
      if (genreIds.some(id => [28, 12, 10752].includes(id))) counts.adrenaline++;
      if (genreIds.some(id => [35, 16].includes(id))) counts.popcorn++;
      if (genreIds.some(id => [18, 10749, 10751].includes(id))) counts.cozy++;
      if (rating >= 8.0) counts.acclaimed++;
    }

    return counts;
  });

  public readonly moodFilteredMovies = computed<ContentDocType[]>(() => {
    const list = this.watchlistMovies();
    const mood = this.activeMood();
    if (mood === 'all') return list;

    return list.filter(item => {
      const payload = item.payload as Record<string, unknown> | undefined;
      if (!payload) return false;

      const runtime = Number(payload['runtime'] || 0);
      const rating = Number(payload['vote_average'] || 0);

      let genreIds: number[] = [];
      if (Array.isArray(payload['genre_ids'])) {
        genreIds = payload['genre_ids'].map(Number);
      } else if (Array.isArray(payload['genres'])) {
        genreIds = (payload['genres'] as (Record<string, unknown> | number)[]).map(g =>
          typeof g === 'object' && g !== null ? Number(g['id'] || 0) : Number(g)
        );
      }

      switch (mood) {
        case 'quick':
          return runtime > 0 ? runtime <= 95 : false;
        case 'mind_bending':
          return genreIds.some(id => [9648, 878, 53].includes(id));
        case 'adrenaline':
          return genreIds.some(id => [28, 12, 10752].includes(id));
        case 'popcorn':
          return genreIds.some(id => [35, 16].includes(id));
        case 'cozy':
          return genreIds.some(id => [18, 10749, 10751].includes(id));
        case 'acclaimed':
          return rating >= 8.0;
        default:
          return true;
      }
    });
  });

  // Current index in the active pool
  public readonly currentPoolIndex = computed<number>(() => {
    const movie = this.selectedMovie();
    const pool = this.moodFilteredMovies();
    if (!movie || pool.length === 0) return 0;
    const idx = pool.findIndex(m => m.id === movie.id);
    return idx >= 0 ? idx : 0;
  });

  // Contextual "Why This Pick?" Hook
  public readonly currentWhyThisPick = computed<ContextualHook>(() => {
    return getContextualHook(this.selectedMovie());
  });

  private providerCache = new Map<string, StreamingAvailability>();

  constructor() {
    addIcons({
      diceOutline,
      shuffleOutline,
      sparkles,
      playOutline,
      checkmarkCircle,
      timeOutline,
      filmOutline,
      star,
      flameOutline,
      bookmark,
      sunnyOutline,
      moonOutline,
      tvOutline,
      informationCircleOutline,
      globeOutline,
      pricetagOutline
    });

    // Auto-select initial movie when pool changes
    effect(() => {
      const pool = this.moodFilteredMovies();
      const current = untracked(() => this.selectedMovie());
      if (pool.length === 0) {
        this.selectedMovie.set(null);
        return;
      }
      if (!current || !pool.some(m => m.id === current.id)) {
        this.selectedMovie.set(pool[0]);
      }
    });

    // Fetch watch providers when selected movie changes
    effect(() => {
      const movie = this.selectedMovie();
      if (!movie) {
        this.streamingDetails.set({
          region: this.userRegion(),
          type: 'none',
          providers: [],
          label: `NOT STREAMING IN ${this.userRegion()}`,
          subtext: 'No movie selected'
        });
        return;
      }
      void this.loadWatchProviders(movie.tmdbId);
    });
  }

  public setMood(mood: CineMatchMood): void {
    if (this.activeMood() === mood) return;
    this.activeMood.set(mood);
    void this.rollTheDice();
  }

  public async rollTheDice(): Promise<void> {
    const pool = this.moodFilteredMovies();
    if (pool.length === 0) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // safe fallback in browser
    }

    // Trigger smooth fade transition
    this.isShuffling.set(true);

    setTimeout(async () => {
      const currentId = this.selectedMovie()?.id;
      const candidates = pool.filter(m => m.id !== currentId);
      const nextPool = candidates.length > 0 ? candidates : pool;
      const randomIdx = Math.floor(Math.random() * nextPool.length);

      this.selectedMovie.set(nextPool[randomIdx]);
      this.isShuffling.set(false);

      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {
        // safe fallback
      }
    }, 180);
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

  // Model Helpers
  public getTitle(doc: ContentDocType | null): string {
    return getMovieTitle(doc);
  }
  public getPoster(doc: ContentDocType | null): string {
    return getMoviePoster(doc);
  }
  public getBackdrop(doc: ContentDocType | null): string {
    return getMovieBackdrop(doc);
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
  public getTimeAgo(addedAt: string | undefined): string {
    return getAddedTimeAgo(addedAt);
  }
  public getOverview(doc: ContentDocType | null): string {
    return getMovieOverview(doc);
  }
  public getGenres(doc: ContentDocType | null): string[] {
    return getMovieGenres(doc);
  }
  public getProviderLogo(logoPath: string): string {
    return resolveMediaImageUrl(logoPath, 'w185');
  }
}
