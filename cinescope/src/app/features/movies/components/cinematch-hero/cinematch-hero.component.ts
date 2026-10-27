import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, untracked } from '@angular/core';
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
  bookmark
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import {
  CineMatchMood,
  MoodFilterOption,
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
  public watchlistMovies = input.required<ContentDocType[]>();

  public openDetail = output<number>();
  public discoverClick = output();
  public toggleBookmark = output<ContentDocType>();
  public markWatched = output<ContentDocType>();

  public readonly activeMood = signal<CineMatchMood>('all');
  public readonly selectedMovie = signal<ContentDocType | null>(null);
  public readonly isShuffling = signal<boolean>(false);

  public readonly moodOptions: MoodFilterOption[] = [
    { id: 'all', label: 'Any Mood', icon: 'shuffle-outline' },
    { id: 'quick', label: '< 95 Mins', icon: 'time-outline' },
    { id: 'mind_bending', label: 'Mind-Bending', icon: 'sparkles' },
    { id: 'adrenaline', label: 'Adrenaline', icon: 'flame-outline' },
    { id: 'popcorn', label: 'Popcorn Fun', icon: 'film-outline' },
    { id: 'cozy', label: 'Cozy & Drama', icon: 'film-outline' },
    { id: 'acclaimed', label: 'Critically Acclaimed (★ 8+)', icon: 'star' }
  ];

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
      bookmark
    });

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
  }

  public setMood(mood: CineMatchMood): void {
    if (this.activeMood() === mood) return;
    this.activeMood.set(mood);
    this.rollTheDice();
  }

  public async rollTheDice(): Promise<void> {
    const pool = this.moodFilteredMovies();
    if (pool.length === 0) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // safe fallback in browser environments
    }

    this.isShuffling.set(true);
    setTimeout(() => {
      const randomIdx = Math.floor(Math.random() * pool.length);
      this.selectedMovie.set(pool[randomIdx]);
      this.isShuffling.set(false);
    }, 250);
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
}
