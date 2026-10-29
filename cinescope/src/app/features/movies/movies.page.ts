import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { optionsOutline, chevronForwardOutline } from 'ionicons/icons';

import { HeaderComponent } from '../../shared/components/header/header.component';
import { StorageService, TmdbPayload } from '../../core/services/storage.service';
import { FranchiseAggregatorService } from '../../core/services/franchise-aggregator.service';
import { ToastService } from '../../core/services/toast.service';
import { MoviesPreferencesService } from '../../core/services/movies-preferences.service';
import { ContentDocType } from '../../core/database/schemas/content.schema';

// Subcomponents
import { CinematchHeroComponent } from './components/cinematch-hero/cinematch-hero.component';
import { FranchiseTrackerComponent } from './components/franchise-tracker/franchise-tracker.component';
import { BlindTicketComponent } from './components/blind-ticket/blind-ticket.component';

import { getMovieTitle } from './movies.models';

@Component({
  selector: 'app-movies',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    HeaderComponent,
    CinematchHeroComponent,
    FranchiseTrackerComponent,
    BlindTicketComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movies.page.html',
  styleUrls: ['./movies.page.scss']
})
export class MoviesPage {
  public storage = inject(StorageService);
  public franchiseAggregator = inject(FranchiseAggregatorService);
  public moviesPrefs = inject(MoviesPreferencesService);
  private toast = inject(ToastService);
  private router = inject(Router);

  // Watchlist filtered strictly to movies
  public readonly watchlistMovies = computed<ContentDocType[]>(() => {
    return this.storage.watchlistItems().filter(item => item.mediaType === 'movie');
  });

  // Active user franchise sagas in progress
  public readonly franchiseSuggestions = computed(() => {
    const suggestions = this.franchiseAggregator.activeUserFranchises().filter(franchise =>
      franchise.completionPercentage < 100 || (franchise.upcomingPartsCount ?? 0) > 0
    );

    return [...suggestions].sort((a, b) => {
      const priority = (franchise: typeof a): number => {
        if (franchise.upNextPart && franchise.watchlistCount > 0) return 0;
        if (franchise.upNextPart) return 1;
        if (franchise.watchlistCount > 0) return 2;
        if ((franchise.upcomingPartsCount ?? 0) > 0) return 3;
        return 4;
      };

      return priority(a) - priority(b)
        || b.completionPercentage - a.completionPercentage
        || a.name.localeCompare(b.name);
    });
  });

  // Check if all 3 sections are hidden in settings
  public readonly allSectionsHidden = computed<boolean>(() => {
    const v = this.moviesPrefs.visibility();
    return !v.cineMatch && !v.franchises && !v.blindTicket;
  });

  constructor() {
    addIcons({
      optionsOutline,
      chevronForwardOutline
    });
  }

  // Navigation handlers
  public openMovieDetail(tmdbId: number): void {
    void this.router.navigate(['/media', 'movie', tmdbId]);
  }

  public openCollection(collectionId: string | number, name: string): void {
    void this.router.navigate(['/collection', collectionId], {
      queryParams: { title: name }
    });
  }

  public navigateToDiscover(): void {
    void this.router.navigate(['/tabs', 'discover']);
  }

  public openSettings(): void {
    void this.router.navigate(['/settings']);
  }

  public onPullRefresh(event: CustomEvent): void {
    const target = event.target as HTMLIonRefresherElement | null;
    setTimeout(() => {
      target?.complete();
    }, 500);
  }

  // Watchlist Actions
  public async onToggleBookmark(doc: ContentDocType): Promise<void> {
    const title = getMovieTitle(doc);
    const newState = await this.storage.cycleBookmark(
      doc.tmdbId,
      'movie',
      doc.payload as TmdbPayload
    );
    if (newState === 'none') {
      await this.toast.presentInfo(`Removed "${title}" from Watchlist`, 2000);
    } else {
      await this.toast.presentSuccess(`Saved "${title}" to Watchlist`, 2000);
    }
  }

  public async onMarkWatched(doc: ContentDocType): Promise<void> {
    const title = getMovieTitle(doc);
    await this.storage.moveToWatched(doc.tmdbId, 'movie', doc.payload as TmdbPayload);
    await this.toast.presentSuccess(`Marked "${title}" as Watched`, 2000);
  }
}
