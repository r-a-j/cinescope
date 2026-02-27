import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonChip,
  IonLabel,
  IonFooter
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { add, bookmark, checkmarkDone, trash, optionsSharp } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { BaseMediaPage } from '../core/classes/base-media.page';

@Component({
  selector: 'app-tv',
  templateUrl: 'tv.page.html',
  styleUrls: ['tv.page.scss'],
  imports: [IonLabel, IonChip, IonTitle, IonToolbar, IonHeader, IonModal, IonFooter,
    IonCheckbox,
    IonButtons,
    IonButton,
    IonIcon,
    FormsModule,
    CommonModule,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent],
})
export class TvPage extends BaseMediaPage {
  readonly mediaType = 'tv';

  constructor() {
    super();
    addIcons({
      add,
      trash,
      bookmark,
      checkmarkDone,
      optionsSharp
    });
  }

  async loadMedia(): Promise<void> {
    const [watchlistItems, watchedItems] = await Promise.all([
      this.storageService.getWatchlist(),
      this.storageService.getWatched()
    ]);

    const tvWatchlist = watchlistItems.filter(item => item.isTv).reverse();
    const tvWatched = watchedItems.filter(item => item.isTv).reverse();

    // Mapping name to title for normalized processing
    this.watchlist = tvWatchlist.map(item => ({
      id: item.contentId,
      title: item.name,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      release_date: item.first_air_date
    }));

    this.watched = tvWatched.map(item => ({
      id: item.contentId,
      title: item.name,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      release_date: item.first_air_date
    }));

    const gSet = new Set<string>();
    [...this.watchlist, ...this.watched].forEach(tv => tv.genres?.forEach(g => gSet.add(g.name!)));
    this.genres = Array.from(gSet).sort();

    for (const selected of this.selectedGenres) {
      if (!this.genres.includes(selected)) {
        this.selectedGenres.delete(selected);
      }
    }
  }

  navigateToDetail(id: number | string): void {
    this.router.navigate(['/tv-detail', id]);
  }
}
