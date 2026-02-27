import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonIcon,
  IonButtons,
  IonButton,
  IonCheckbox,
  IonModal,
  IonChip,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonLabel,
  IonFooter
} from "@ionic/angular/standalone";
import { HeaderComponent } from '../header/header.component';
import { bookmark, checkmarkDone, trash, construct, optionsSharp } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { BaseMediaPage } from '../core/classes/base-media.page';

@Component({
  selector: 'app-movie',
  templateUrl: 'movie.page.html',
  styleUrls: ['movie.page.scss'],
  imports: [IonLabel,
    IonModal,
    IonFooter,
    IonChip,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCheckbox,
    IonButton,
    IonButtons,
    FormsModule,
    CommonModule,
    IonIcon,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent
  ],
})
export class MoviePage extends BaseMediaPage {
  readonly mediaType = 'movie';

  constructor() {
    super();
    addIcons({ trash, bookmark, checkmarkDone, construct, optionsSharp });
  }

  async loadMedia(): Promise<void> {
    const [watchlistItems, watchedItems] = await Promise.all([
      this.storageService.getWatchlist(),
      this.storageService.getWatched()
    ]);

    const movieWatchlist = watchlistItems.filter(item => item.isMovie).reverse();
    const movieWatched = watchedItems.filter(item => item.isMovie).reverse();

    this.watchlist = movieWatchlist.map(item => ({
      id: item.contentId,
      title: item.title,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      release_date: item.release_date
    }));

    this.watched = movieWatched.map(item => ({
      id: item.contentId,
      title: item.title,
      poster_path: item.poster_path,
      genres: item.genres,
      vote_average: item.vote_average,
      release_date: item.release_date
    }));

    const gSet = new Set<string>();
    [...this.watchlist, ...this.watched].forEach(m => m.genres?.forEach(g => gSet.add(g.name!)));
    this.genres = Array.from(gSet).sort();

    for (const selected of this.selectedGenres) {
      if (!this.genres.includes(selected)) {
        this.selectedGenres.delete(selected);
      }
    }
  }

  navigateToDetail(id: number | string): void {
    this.router.navigate(['/movie-detail', id]);
  }
}