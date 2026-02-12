import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonToolbar, IonSegmentButton, IonLabel, IonSegment, IonChip, IonSkeletonText, IonItem, IonList, IonFab, IonFabButton, IonIcon } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { MediaCarouselComponent } from '../shared/components/media-carousel/media-carousel.component';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import { arrowUpOutline } from 'ionicons/icons';
import { RouterModule } from '@angular/router';

interface DiscoverSection {
  title: string;
  method: string;
  viewAllRoute?: string;
  type: 'movie' | 'tv' | 'person';
  items: any[];
  params?: any;
}

@Component({
  selector: 'app-discover',
  templateUrl: 'discover.page.html',
  styleUrls: ['discover.page.scss'],
  standalone: true,
  imports: [
    IonIcon,
    IonFabButton,
    IonFab,
    IonSkeletonText,
    IonLabel,
    IonChip,
    IonSegment,
    IonSegmentButton,
    IonToolbar,
    IonContent,
    CommonModule,
    FormsModule,
    HeaderComponent,
    MediaCarouselComponent,
    RouterModule
  ],
})
export class DiscoverPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;

  segmentValue: string = 'bollywood';
  isLoading: boolean = false;
  selectedLanguage: string = 'hi';
  heroItem: any = null;
  showScrollBtn: boolean = false;

  languageChips = [
    { label: 'Hindi', value: 'hi' },
    { label: 'Telugu', value: 'te' },
    { label: 'Tamil', value: 'ta' },
    { label: 'Malayalam', value: 'ml' },
    { label: 'Kannada', value: 'kn' },
    { label: 'Marathi', value: 'mr' },
    { label: 'Bengali', value: 'bn' },
    { label: 'Gujarati', value: 'gu' }
  ];

  currentSections: DiscoverSection[] = [];

  // Static Definitions
  bollywoodSections: DiscoverSection[] = [
    { title: 'Trending Bollywood', method: 'getTrendingBollywoodMovies', type: 'movie', items: [] },
    { title: 'Top Rated Hindi', method: 'getTopRatedMovies', params: { with_original_language: 'hi' }, type: 'movie', items: [] },
    { title: 'Upcoming Hindi', method: 'getUpcomingMovies', params: { with_original_language: 'hi', region: 'IN' }, type: 'movie', items: [] }
  ];

  topRatedSections: DiscoverSection[] = [
    { title: 'Top Rated Movies', method: 'getTopRatedMovies', type: 'movie', items: [], viewAllRoute: '/top-rated-movies' },
    { title: 'Top Rated TV Shows', method: 'getTopRatedTV', type: 'tv', items: [], viewAllRoute: '/top-rated-tv' }
  ];

  trendingSections: DiscoverSection[] = [
    { title: 'Trending Movies', method: 'getTrendingMovies', type: 'movie', items: [] },
    { title: 'Trending TV', method: 'getTrendingTV', type: 'tv', items: [] }
  ];

  actorSections: DiscoverSection[] = [
    { title: 'Popular Actors', method: 'getPopularPersons', type: 'person', items: [] }
  ];

  desiSections: DiscoverSection[] = [];

  constructor(private tmdbService: TmdbSearchService) {
    addIcons({ arrowUpOutline });
  }

  ngOnInit() {
    this.segmentChanged();
  }

  segmentChanged() {
    this.currentSections = [];
    this.heroItem = null;
    this.isLoading = true;

    switch (this.segmentValue) {
      case 'bollywood':
        this.currentSections = this.bollywoodSections;
        break;
      case 'topRated':
        this.currentSections = this.topRatedSections;
        break;
      case 'trending':
        this.currentSections = this.trendingSections;
        break;
      case 'actors':
        this.currentSections = this.actorSections;
        break;
      case 'desi':
        this.generateDesiSections();
        this.currentSections = this.desiSections;
        break;
    }

    this.loadSections(this.currentSections);
  }

  languageChanged(lang: string) {
    this.selectedLanguage = lang;

    // Don't clear heroItem immediately to avoid flashing white
    // this.heroItem = null; 

    if (this.segmentValue === 'desi') {
      this.generateDesiSections();
      this.currentSections = this.desiSections;
      this.loadSections(this.currentSections);
    }
  }

  generateDesiSections() {
    const langLabel = this.languageChips.find(l => l.value === this.selectedLanguage)?.label || 'Indian';

    this.desiSections = [
      {
        title: `New ${langLabel} Releases`,
        method: 'getDiscoverMovies',
        type: 'movie',
        items: [],
        params: {
          with_original_language: this.selectedLanguage,
          sort_by: 'primary_release_date.desc',
          'primary_release_date.lte': new Date().toISOString().split('T')[0],
          with_origin_country: 'IN'
        }
      },
      {
        title: `Popular in ${langLabel}`,
        method: 'getDiscoverMovies',
        type: 'movie',
        items: [],
        params: {
          with_original_language: this.selectedLanguage,
          sort_by: 'popularity.desc',
          with_origin_country: 'IN'
        }
      },
      {
        title: `Top Rated ${langLabel}`,
        method: 'getDiscoverMovies',
        type: 'movie',
        items: [],
        params: {
          with_original_language: this.selectedLanguage,
          sort_by: 'vote_average.desc',
          'vote_count.gte': 50,
          with_origin_country: 'IN'
        }
      },
      {
        title: `${langLabel} Action Hits`,
        method: 'getDiscoverMovies',
        type: 'movie',
        items: [],
        params: {
          with_original_language: this.selectedLanguage,
          with_genres: '28',
          sort_by: 'popularity.desc'
        }
      }
    ];
  }

  private loadSections(sections: DiscoverSection[]) {
    this.isLoading = true;
    let pendingCalls = 0;

    sections.forEach((section, index) => {
      if (section.items.length === 0) {
        pendingCalls++;

        let obs: Observable<any>;
        if (section.method === 'getDiscoverMovies') {
          obs = this.tmdbService.getDiscoverMovies(section.params);
        } else if (this.tmdbService[section.method as keyof TmdbSearchService]) {
          // @ts-ignore
          obs = this.tmdbService[section.method](...Object.values(section.params || {}));
        } else {
          console.warn(`Method ${section.method} not found`);
          pendingCalls--;
          return;
        }

        obs.subscribe({
          next: (data: any) => {
            section.items = data.results || [];

            // Set Hero Item from the FIRST section (Trending/New)
            if (index === 0 && section.items.length > 0) {
              this.heroItem = section.items[0];
            }

            pendingCalls--;
            if (pendingCalls <= 0) this.isLoading = false;
          },
          error: () => {
            pendingCalls--;
            if (pendingCalls <= 0) this.isLoading = false;
          }
        });
      } else {
        if (index === 0 && section.items.length > 0) {
          this.heroItem = section.items[0];
        }
      }
    });

    if (pendingCalls === 0) this.isLoading = false;
  }

  handleScroll(event: any) {
    const scrollTop = event.detail.scrollTop;
    this.showScrollBtn = scrollTop > 400;
  }

  scrollToTop() {
    this.content.scrollToTop(500);
  }
}