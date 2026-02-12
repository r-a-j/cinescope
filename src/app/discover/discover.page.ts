import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
export class DiscoverPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;

  segmentValue: string = 'bollywood';
  isLoading: boolean = false;
  selectedLanguage: string = 'hi';
  showScrollBtn: boolean = false;

  // HERO LOGIC
  heroItem: any = null;
  validHeroItems: any[] = [];
  heroRotationInterval: any;
  currentHeroIndex: number = 0;

  // Double-Buffer
  heroBackdrops: string[] = ['', ''];
  activeBackdropIndex: number = 0;

  // Swipe Logic
  private touchStartX = 0;
  private touchEndX = 0;

  languageChips = [
    { label: 'Hindi', value: 'hi' },
    { label: 'Marathi', value: 'mr' },
    { label: 'Gujarati', value: 'gu' },
    { label: 'Telugu', value: 'te' },
    { label: 'Tamil', value: 'ta' },
    { label: 'Malayalam', value: 'ml' },
    { label: 'Kannada', value: 'kn' },
    { label: 'Bengali', value: 'bn' },
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

  ngOnDestroy() {
    this.stopHeroRotation();
  }

  startHeroRotation() {
    this.stopHeroRotation();
    this.heroRotationInterval = setInterval(() => {
      this.changeHeroItem(1);
    }, 6000);
  }

  stopHeroRotation() {
    if (this.heroRotationInterval) {
      clearInterval(this.heroRotationInterval);
      this.heroRotationInterval = null;
    }
  }

  segmentChanged() {
    this.stopHeroRotation();
    this.currentSections = [];
    this.heroItem = null;
    this.isLoading = true;

    switch (this.segmentValue) {
      case 'bollywood': this.currentSections = this.bollywoodSections; break;
      case 'topRated': this.currentSections = this.topRatedSections; break;
      case 'trending': this.currentSections = this.trendingSections; break;
      case 'actors': this.currentSections = this.actorSections; break;
      case 'desi':
        this.generateDesiSections();
        this.currentSections = this.desiSections;
        break;
    }

    this.loadSections(this.currentSections);
  }

  languageChanged(lang: string) {
    this.selectedLanguage = lang;
    this.stopHeroRotation();

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
          pendingCalls--;
          return;
        }

        obs.subscribe({
          next: (data: any) => {
            section.items = data.results || [];
            if (index === 0 && section.items.length > 0) {
              this.initHeroRotation(section.items);
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
          this.initHeroRotation(section.items);
        }
      }
    });

    if (pendingCalls === 0) this.isLoading = false;
  }

  private initHeroRotation(items: any[]) {
    if (!items || items.length === 0) return;

    // Filter for 16:9 Backdrops
    this.validHeroItems = items.filter(i => !!i.backdrop_path);

    if (this.validHeroItems.length === 0) {
      this.heroItem = items[0];
      const url = 'https://image.tmdb.org/t/p/original' + (this.heroItem.backdrop_path || this.heroItem.poster_path);
      this.heroBackdrops[0] = url;
      this.heroBackdrops[1] = url;
      return;
    }

    // Set Initial State
    this.currentHeroIndex = 0;
    this.heroItem = this.validHeroItems[0];

    const firstUrl = 'https://image.tmdb.org/t/p/original' + this.heroItem.backdrop_path;
    this.heroBackdrops[0] = firstUrl;
    this.heroBackdrops[1] = firstUrl;
    this.activeBackdropIndex = 0;

    if (this.validHeroItems.length > 1) {
      this.startHeroRotation();
    }
  }

  // 🔄 UNIFIED CHANGE LOGIC (Used by Timer & Swipe)
  // step: 1 for Next, -1 for Previous
  changeHeroItem(step: number) {
    if (this.validHeroItems.length <= 1) return;

    // Calculate next index (handling wrap-around for negative numbers too)
    const len = Math.min(this.validHeroItems.length, 5); // Cycle max 5 items
    this.currentHeroIndex = (this.currentHeroIndex + step + len) % len;

    const nextItem = this.validHeroItems[this.currentHeroIndex];
    const nextUrl = 'https://image.tmdb.org/t/p/original' + nextItem.backdrop_path;
    const nextLayerIndex = this.activeBackdropIndex === 0 ? 1 : 0;

    // Preload & Switch
    const img = new Image();
    img.src = nextUrl;
    img.onload = () => {
      this.heroBackdrops[nextLayerIndex] = nextUrl;
      this.activeBackdropIndex = nextLayerIndex;
      this.heroItem = nextItem;
    };
  }

  // 👆 SWIPE HANDLERS
  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.changedTouches[0].screenX;
  }

  onTouchEnd(e: TouchEvent) {
    this.touchEndX = e.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const SWIPE_THRESHOLD = 50; // Minimum distance to be a swipe
    if (this.touchEndX < this.touchStartX - SWIPE_THRESHOLD) {
      // Swiped Left -> Show Next
      this.manualChange(1);
    } else if (this.touchEndX > this.touchStartX + SWIPE_THRESHOLD) {
      // Swiped Right -> Show Previous
      this.manualChange(-1);
    }
  }

  // Handle manual interaction
  private manualChange(step: number) {
    this.stopHeroRotation(); // Stop timer so it doesn't jump while reading
    this.changeHeroItem(step);
    this.startHeroRotation(); // Restart timer
  }

  handleScroll(event: any) {
    const scrollTop = event.detail.scrollTop;
    this.showScrollBtn = scrollTop > 400;
  }

  scrollToTop() {
    this.content.scrollToTop(500);
  }
}