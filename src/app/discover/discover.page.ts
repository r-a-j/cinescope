import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonToolbar, IonSegmentButton, IonLabel, IonSegment, IonChip, IonSkeletonText, IonFab, IonFabButton, IonIcon } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { MediaCarouselComponent } from '../shared/components/media-carousel/media-carousel.component';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import { arrowUpOutline, star } from 'ionicons/icons';
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
  @ViewChild('heroWrapper') set heroWrapper(el: ElementRef) {
    if (el && el.nativeElement) {
      this.attachNativeListeners(el.nativeElement);
    } else {
      this.detachNativeListeners();
    }
  }

  // Touch Tracking Variables
  private touchStartX = 0;
  private touchStartY = 0;
  private activeHeroElement: HTMLElement | null = null;

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
  desiSections: DiscoverSection[] = [];
  actorSections: DiscoverSection[] = [];

  // Static Definitions
  bollywoodSections: DiscoverSection[] = [
    {
      title: 'Trending Bollywood',
      method: 'getTrendingBollywoodMovies',
      type: 'movie',
      items: []
    },
    {
      title: 'Top Rated Hindi',
      method: 'getDiscoverMovies',
      params: {
        with_original_language: 'hi',
        with_origin_country: 'IN',
        sort_by: 'vote_average.desc',
        'vote_count.gte': 300
      },
      type: 'movie',
      items: []
    },
    {
      title: 'Upcoming Hindi',
      method: 'getUpcomingMovies',
      type: 'movie',
      items: []
    }
  ];

  topRatedSections: DiscoverSection[] = [
    {
      title: 'Top Rated Movies',
      method: 'getTopRatedMovies',
      type: 'movie',
      items: []
    },
    {
      title: 'Top Rated TV Shows',
      method: 'getTopRatedTV',
      type: 'tv',
      items: []
    }
  ];

  trendingSections: DiscoverSection[] = [
    {
      title: 'Trending Movies',
      method: 'getTrendingMovies',
      type: 'movie',
      items: []
    },
    {
      title: 'Trending TV',
      method: 'getTrendingTv',
      type: 'tv',
      items: []
    }
  ];

  constructor(private tmdbService: TmdbSearchService) {
    addIcons({ star, arrowUpOutline });
  }

  getQueryParams(section: DiscoverSection) {
    return {
      title: section.title,
      method: section.method,
      type: section.type,
      extraParams: section.params ? JSON.stringify(section.params) : null
    };
  }

  ngOnInit() {
    this.segmentChanged();
  }

  ngOnDestroy() {
    this.stopHeroRotation();
    this.detachNativeListeners();
  }

  private attachNativeListeners(el: HTMLElement) {
    this.detachNativeListeners(); // Safety cleanup
    this.activeHeroElement = el;

    // { passive: true } is the magic. It tells browser "I promise not to block scroll"
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchend', this.onTouchEnd, { passive: true });
  }

  private detachNativeListeners() {
    if (this.activeHeroElement) {
      this.activeHeroElement.removeEventListener('touchstart', this.onTouchStart);
      this.activeHeroElement.removeEventListener('touchend', this.onTouchEnd);
      this.activeHeroElement = null;
    }
  }

  // Bound Arrow Functions to preserve 'this' context
  private onTouchStart = (e: TouchEvent) => {
    this.touchStartX = e.changedTouches[0].screenX;
    this.touchStartY = e.changedTouches[0].screenY;
  }

  private onTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0].screenX;
    const endY = e.changedTouches[0].screenY;

    const diffX = endX - this.touchStartX;
    const diffY = endY - this.touchStartY;

    // 🧠 LOGIC: If vertical scroll was dominant, IGNORE swipe.
    // This allows the user to scroll down without accidentally changing the movie.
    if (Math.abs(diffY) > Math.abs(diffX)) return;

    // 50px threshold for horizontal swipe
    if (Math.abs(diffX) > 50) {
      if (diffX < 0) {
        this.manualChange(1); // Swipe Left -> Next
      } else {
        this.manualChange(-1); // Swipe Right -> Prev
      }
    }
  }

  startHeroRotation() {
    this.stopHeroRotation();
    this.heroRotationInterval = setInterval(() => {
      this.changeHeroItem(1);
    }, 12000);
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
        this.generateActorSections();
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
    this.stopHeroRotation();

    if (this.segmentValue === 'desi') {
      this.generateDesiSections();
      this.currentSections = this.desiSections;
      this.loadSections(this.currentSections);
    }
  }

  generateActorSections() {
    this.actorSections = [
      {
        title: 'Desi Icons 🔥',
        method: 'getTrendingIndianStars',
        type: 'person',
        items: []
      },
      {
        title: 'Trending Worldwide',
        method: 'getPopularPersons',
        params: { page: 2 },
        type: 'person',
        items: []
      },
      {
        title: 'Next Gen & Rising 🚀',
        method: 'getPopularPersons',
        params: { page: 3 },
        type: 'person',
        items: []
      },
      {
        title: 'The G.O.A.T.s 🌟',
        method: 'getPopularPersons',
        params: { page: 1 },
        type: 'person',
        items: []
      },
    ];
  }

  generateDesiSections() {
    const langLabel = this.languageChips.find(l => l.value === this.selectedLanguage)?.label || 'Indian';

    this.desiSections = [
      {
        title: `🔥 Trending Pan-India`,
        method: 'getTrendingIndia',
        type: 'movie',
        items: [],
        viewAllRoute: `/view-all/trending-pan-india`
      },
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
        },
        viewAllRoute: `/view-all/new-releases/${this.selectedLanguage}`
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
        },
        viewAllRoute: `/view-all/popular/${this.selectedLanguage}`
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
        },
        viewAllRoute: `/view-all/top-rated/${this.selectedLanguage}`
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
        },
        viewAllRoute: `/view-all/action-hits/${this.selectedLanguage}`
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
        } else if ((this.tmdbService as any)[section.method]) {
          // FIX: Extract args and call dynamically using 'as any'
          const args = section.params ? Object.values(section.params) : [];
          obs = (this.tmdbService as any)[section.method](...args);
        } else {
          console.warn(`Method ${section.method} not found in TmdbSearchService`);
          pendingCalls--;
          return;
        }

        obs.subscribe({
          next: (data: any) => {
            section.items = data.results || [];
            if (index === 0 && section.items.length > 0) {
              this.initHeroRotation(section.items, section.type);
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
        // If data exists, just init hero if it's the top section
        if (index === 0 && section.items.length > 0) {
          this.initHeroRotation(section.items, section.type);
        }
      }
    });

    if (pendingCalls === 0) this.isLoading = false;
  }

  private getHeroBackdropUrl(item: any): string {
    // If it's a person, grab the backdrop from their first 'known_for' movie
    if (item.known_for && item.known_for.length > 0 && item.known_for[0].backdrop_path) {
      return 'https://image.tmdb.org/t/p/original' + item.known_for[0].backdrop_path;
    }
    // Otherwise standard item backdrop
    return 'https://image.tmdb.org/t/p/original' + (item.backdrop_path || item.poster_path);
  }

  // REPLACED METHOD
  private initHeroRotation(items: any[], type: 'movie' | 'tv' | 'person') {
    if (!items || items.length === 0) return;

    if (type === 'person') {
      // For Persons: Filter those who actually have a movie backdrop in 'known_for'
      // This prevents showing actors with no good background image
      this.validHeroItems = items.filter(p => p.known_for && p.known_for.length > 0 && p.known_for[0].backdrop_path);
    } else {
      // For Movies/TV: Must have direct backdrop
      this.validHeroItems = items.filter(i => !!i.backdrop_path);
    }

    if (this.validHeroItems.length === 0) {
      // Fallback: If filtering removed everyone, just take the first raw item
      this.heroItem = items[0];
      this.heroItem.media_type = type;
      const url = 'https://image.tmdb.org/t/p/original' + (this.heroItem.backdrop_path || this.heroItem.poster_path || this.heroItem.profile_path);
      this.heroBackdrops[0] = url;
      this.heroBackdrops[1] = url;
      return;
    }

    this.currentHeroIndex = 0;
    this.heroItem = this.validHeroItems[0];
    this.heroItem.media_type = type;

    // Use the helper to get the correct URL (Profile vs Backdrop)
    const firstUrl = this.getHeroBackdropUrl(this.heroItem);

    this.heroBackdrops[0] = firstUrl;
    this.heroBackdrops[1] = firstUrl;
    this.activeBackdropIndex = 0;

    if (this.validHeroItems.length > 1) {
      this.startHeroRotation();
    }
  }

  updateBackdrops(isInitial: boolean) {
    const nextUrl = this.getHeroBackdropUrl(this.heroItem);
    const nextLayerIndex = isInitial ? 0 : (this.activeBackdropIndex === 0 ? 1 : 0);

    const img = new Image();
    img.src = nextUrl;
    img.onload = () => {
      this.heroBackdrops[nextLayerIndex] = nextUrl;

      if (isInitial) {
        this.heroBackdrops[1] = nextUrl;
      }
      this.activeBackdropIndex = nextLayerIndex;
    };
  }

  changeHeroItem(step: number) {
    if (this.validHeroItems.length <= 1) return;

    const len = Math.min(this.validHeroItems.length, 8);
    this.currentHeroIndex = (this.currentHeroIndex + step + len) % len;
    const nextItem = this.validHeroItems[this.currentHeroIndex];
    if (this.heroItem && this.heroItem.media_type) {
      nextItem.media_type = this.heroItem.media_type;
    }
    const nextUrl = this.getHeroBackdropUrl(nextItem);
    const nextLayerIndex = this.activeBackdropIndex === 0 ? 1 : 0;

    const img = new Image();
    img.src = nextUrl;
    img.onload = () => {
      this.heroBackdrops[nextLayerIndex] = nextUrl;
      this.activeBackdropIndex = nextLayerIndex;
      this.heroItem = nextItem;
    };
  }

  private manualChange(step: number) {
    this.stopHeroRotation();
    this.changeHeroItem(step);
    this.startHeroRotation();
  }

  handleScroll(event: any) {
    this.showScrollBtn = event.detail.scrollTop > 400;
  }

  scrollToTop() {
    this.content.scrollToTop(500);
  }
}