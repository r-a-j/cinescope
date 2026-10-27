import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  playOutline,
  trashOutline,
  alarmOutline
} from 'ionicons/icons';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import {
  getMovieTitle,
  getMoviePoster,
  getMovieRating,
  getAddedTimeAgo
} from '../../movies.models';

@Component({
  selector: 'app-watchlist-graveyard',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './watchlist-graveyard.component.html',
  styleUrls: ['./watchlist-graveyard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WatchlistGraveyardComponent {
  public watchlistMovies = input.required<ContentDocType[]>();

  public openDetail = output<number>();
  public watchTonight = output<ContentDocType>();
  public letItGo = output<ContentDocType>();
  public snooze = output<ContentDocType>();

  public readonly graveyardMovies = computed<ContentDocType[]>(() => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return this.watchlistMovies().filter(item => {
      const addedTime = new Date(item.addedAt).getTime();
      return !Number.isNaN(addedTime) && addedTime < ninetyDaysAgo;
    }).slice(0, 4);
  });

  constructor() {
    addIcons({
      playOutline,
      trashOutline,
      alarmOutline
    });
  }

  // Model Helpers
  public getTitle(doc: ContentDocType | null): string {
    return getMovieTitle(doc);
  }
  public getPoster(doc: ContentDocType | null): string {
    return getMoviePoster(doc);
  }
  public getRating(doc: ContentDocType | null): string {
    return getMovieRating(doc);
  }
  public getTimeAgo(addedAt: string | undefined): string {
    return getAddedTimeAgo(addedAt);
  }
}
