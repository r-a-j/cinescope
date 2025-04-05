import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSearchbar,
  IonHeader,
  IonButtons,
  IonButton,
  IonIcon,
  IonTitle,
  IonText
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline, clipboardOutline } from 'ionicons/icons';
import { Clipboard } from '@capacitor/clipboard';
import { Dialog } from '@capacitor/dialog';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { MovieSearchResult } from 'src/models/movie/movie-search.model';
import { TvSearchResult } from 'src/models/movie/tv-search.model';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [
    IonText,
    IonTitle,
    IonIcon,
    IonButton,
    IonButtons,
    IonHeader,
    IonSearchbar,
    IonLabel,
    IonSegmentButton,
    IonSegment,
    IonContent,
    IonToolbar,
    CommonModule,
    FormsModule
  ],
})
export class SearchPage implements OnInit, AfterViewInit {
  @ViewChild(IonSearchbar, { static: false }) searchBar!: IonSearchbar;
  segmentValue: 'movies' | 'tv' = 'movies';
  searchQuery: string = '';
  movieResults: MovieSearchResult[] = [];
  tvResults: TvSearchResult[] = [];
  loading = false;
  error: string = '';

  constructor(
    private router: Router,
    private tmdbService: TmdbSearchService
  ) {
    addIcons({ arrowBackOutline, clipboardOutline });
  }

  ngOnInit() {
    // ...
  }

  async pasteFromClipboard(): Promise<void> {
    const { value } = await Clipboard.read();
    if (value) {
      this.searchQuery = value;
    } else {
      await Dialog.alert({
        title: 'Clipboard Empty',
        message: 'There is no text to paste from clipboard.'
      });
    }
  }

  getImageUrl(path: string | null | undefined): string {
    return path ? `https://image.tmdb.org/t/p/w300${path}` : 'assets/placeholder.png';
  }

  async search() {
    if (!this.searchQuery.trim()) return;

    this.loading = true;
    this.error = '';

    if (this.segmentValue === 'movies') {
      this.tmdbService.searchMovies(this.searchQuery).subscribe({
        next: (res) => {
          this.movieResults = res.results;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.message;
          this.loading = false;
        }
      });
    } else {
      this.tmdbService.searchTV(this.searchQuery).subscribe({
        next: (res) => {
          this.tvResults = res.results;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.message;
          this.loading = false;
        }
      });
    }
  }

  async ngAfterViewInit(): Promise<void> {
    setTimeout(async () => {
      try {
        await this.searchBar.setFocus();
        // // Check clipboard
        // const { value } = await Clipboard.read();

        // if (value?.trim()) {
        //   const { value: userConfirmed } = await Dialog.confirm({
        //     title: 'Paste from Clipboard?',
        //     message: `We found "${value}" on your clipboard. Paste it here?`
        //   });

        //   if (userConfirmed) {
        //     this.searchQuery = value;
        //   }
        // }
      } catch (err) {
        console.error('Clipboard read or focus error:', err);
      }
    }, 300);
  }

  goHome(): void {
    this.router.navigate(['/tabs']);
  }

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = 'assets/placeholder.png';
  }
}
