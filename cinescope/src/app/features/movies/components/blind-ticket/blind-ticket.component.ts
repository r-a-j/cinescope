import { Component, ChangeDetectionStrategy, input, output, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  ticketOutline,
  eyeOutline,
  playOutline,
  refreshOutline,
  star,
  timeOutline
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import {
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
  public watchlistMovies = input.required<ContentDocType[]>();
  public openDetail = output<number>();
  public watchTonight = output<ContentDocType>();

  public readonly isBlindTicketRevealed = signal<boolean>(false);
  public readonly blindTicketMovie = signal<ContentDocType | null>(null);

  constructor() {
    addIcons({
      ticketOutline,
      eyeOutline,
      playOutline,
      refreshOutline,
      star,
      timeOutline
    });

    effect(() => {
      const movies = this.watchlistMovies();
      const current = untracked(() => this.blindTicketMovie());
      if (movies.length === 0) {
        this.blindTicketMovie.set(null);
        return;
      }
      if (!current || !movies.some(m => m.id === current.id)) {
        this.pickNextMysteryTicket(false);
      }
    });
  }

  public async tearBlindTicket(): Promise<void> {
    if (this.isBlindTicketRevealed()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // safe fallback
    }
    this.isBlindTicketRevealed.set(true);
  }

  public pickNextMysteryTicket(haptic = true): void {
    const list = this.watchlistMovies();
    if (list.length === 0) return;

    if (haptic) {
      try {
        void Haptics.impact({ style: ImpactStyle.Medium });
      } catch {
        // safe fallback
      }
    }

    const currentId = this.blindTicketMovie()?.id;
    const candidates = list.filter(m => m.id !== currentId);
    const pool = candidates.length > 0 ? candidates : list;
    const nextMovie = pool[Math.floor(Math.random() * pool.length)];

    this.isBlindTicketRevealed.set(false);
    this.blindTicketMovie.set(nextMovie);
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
  public getGenres(doc: ContentDocType | null): string[] {
    return getMovieGenres(doc);
  }
}
