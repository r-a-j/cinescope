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
  IonText,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline, clipboardOutline } from 'ionicons/icons';
import { Clipboard } from '@capacitor/clipboard';
import { Dialog } from '@capacitor/dialog';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { MovieSearchResult } from 'src/models/movie/movie-search.model';
import { LanguageService } from 'src/services/language.service';
import { TvSearchResult } from 'src/models/tv/tv-search.model';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [
    IonInfiniteScrollContent,
    IonInfiniteScroll,
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

  currentPage: number = 1;
  totalPages: number = 1;
  isLoading = false;
  error = '';

  constructor(
    private router: Router,
    private tmdbService: TmdbSearchService,
    private languageService: LanguageService
  ) {
    addIcons({ arrowBackOutline, clipboardOutline });
  }

  ngOnInit() {
    setTimeout(() => this.searchBar?.setFocus(), 300);
  }

  private extractYearAndLanguage(query: string): { cleanQuery: string; year?: string; lang?: string } {
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : undefined;

    const lang = this.languageService.extractLanguageFromQuery(query) ?? undefined;
    const cleanQuery = query
      .replace(year ?? '', '')
      .replace(new RegExp(`\\b${lang}\\b`, 'i'), '')
      .trim();

    return { cleanQuery, year, lang };
  }

  async pasteFromClipboard(): Promise<void> {
    const { value } = await Clipboard.read();
    if (value) {
      this.searchQuery = value;
    } else {
      await Dialog.alert({
        title: 'Clipboard Empty',
        message: 'Nothing to paste.'
      });
    }
  }

  getImageUrl(path: string | null | undefined): string {
    return path ? `https://image.tmdb.org/t/p/w300${path}` : 'assets/placeholder.png';
  }

  loadMore(event: any) {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.search(false);
    } else {
      event.target.disabled = true;
    }
    event.target.complete();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.movieResults = [];
    this.tvResults = [];
    this.currentPage = 1;
  }  

  async search(reset: boolean = false): Promise<void> {
    if (!this.searchQuery.trim()) return;

    if (reset) {
      this.currentPage = 1;
      this.totalPages = 1;
      this.movieResults = [];
      this.tvResults = [];
    }

    this.isLoading = true;
    const page = this.currentPage;

    const onSuccess = (res: any) => {
      this.totalPages = res.total_pages;
      if (this.segmentValue === 'movies') {
        this.movieResults = [...this.movieResults, ...res.results];
        console.log('Movie Results:', this.movieResults);
      } else {
        this.tvResults = [...this.tvResults, ...res.results];
        console.log('Movie Results:', this.tvResults);
      }
      this.isLoading = false;
    };

    const onError = (err: any) => {
      this.error = err.message || 'Something went wrong';
      this.isLoading = false;
    };

    const { cleanQuery, year, lang } = this.extractYearAndLanguage(this.searchQuery.trim());

    if (this.segmentValue === 'movies') {
      this.tmdbService.searchMovies(cleanQuery, page, year, lang).subscribe({ next: onSuccess, error: onError });
    } else {
      this.tmdbService.searchTV(cleanQuery, page, year, lang).subscribe({ next: onSuccess, error: onError });
    }
  }

  async ngAfterViewInit(): Promise<void> {
    setTimeout(async () => {
      try {
        await this.searchBar.setFocus();
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
