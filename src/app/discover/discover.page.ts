import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonToolbar,
  IonSegmentButton,
  IonLabel,
  IonSegment,
  IonChip,
  IonSkeletonText,
  IonFab,
  IonFabButton,
  IonIcon
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { MediaCarouselComponent } from '../shared/components/media-carousel/media-carousel.component';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { TmdbDiscoverService } from '../core/api/tmdb/tmdb-discover.service';
import { TmdbMoviesService } from '../core/api/tmdb/tmdb-movies.service';
import { TmdbTrendingService } from '../core/api/tmdb/tmdb-trending.service';
import { TmdbPeopleService } from '../core/api/tmdb/tmdb-people.service';
import { TmdbTvService } from '../core/api/tmdb/tmdb-tv.service';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import { arrowUpOutline, star } from 'ionicons/icons';
import { RouterModule } from '@angular/router';

interface DiscoverSection {
  title: string;
  fetch$: Observable<any>;
  viewAllRoute?: string;
  type: 'movie' | 'tv' | 'person';
  items: any[];
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

  private touchStartX = 0;
  private touchStartY = 0;
  private activeHeroElement: HTMLElement | null = null;

  segmentValue: string = 'bollywood';
  isLoading: boolean = false;
  selectedLanguage: string = 'hi';
  showScrollBtn: boolean = false;

  heroItem: any = null;
  validHeroItems: any[] = [];
  heroRotationInterval: any;
  currentHeroIndex: number = 0;

  heroBackdrops: string[] = ['', ''];
  activeBackdropIndex: number = 0;

  languageChips = [
    { label: 'Hindi', value: 'hi' },
    { label: 'Marathi', value: 'mr' },
    { label: 'Gujarati', value: 'gu' },
    { label: 'Punjabi', value: 'pa' },
    { label: 'Telugu', value: 'te' },
    { label: 'Tamil', value: 'ta' },
    { label: 'Malayalam', value: 'ml' },
    { label: 'Kannada', value: 'kn' },
    { label: 'Bengali', value: 'bn' },
  ];

  currentSections: DiscoverSection[] = [];
  desiSections: DiscoverSection[] = [];
  actorSections: DiscoverSection[] = [];

  bollywoodSections: DiscoverSection[] = [];
  topRatedSections: DiscoverSection[] = [];
  trendingSections: DiscoverSection[] = [];

  constructor(
    private legacySearchService: TmdbSearchService,
    private tmdbDiscover: TmdbDiscoverService,
    private tmdbMovies: TmdbMoviesService,
    private tmdbTrending: TmdbTrendingService,
    private tmdbPeople: TmdbPeopleService,
    private tmdbTv: TmdbTvService
  ) {
    addIcons({ star, arrowUpOutline });
  }

  getQueryParams(section: DiscoverSection) {
    return {
      title: section.title,
      type: section.type,
      // Note: We might need a different approach for view-all routing since we removed string methods
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
    this.detachNativeListeners();
    this.activeHeroElement = el;

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

  private onTouchStart = (e: TouchEvent) => {
    this.touchStartX = e.changedTouches[0].screenX;
    this.touchStartY = e.changedTouches[0].screenY;
  }

  private onTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0].screenX;
    const endY = e.changedTouches[0].screenY;

    const diffX = endX - this.touchStartX;
    const diffY = endY - this.touchStartY;

    if (Math.abs(diffY) > Math.abs(diffX)) return;

    if (Math.abs(diffX) > 50) {
      if (diffX < 0) {
        this.manualChange(1);
      } else {
        this.manualChange(-1);
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
        this.generateBollywoodSections();
        this.currentSections = this.bollywoodSections;
        break;

      case 'topRated':
        this.generateTopRatedSections();
        this.currentSections = this.topRatedSections;
        break;

      case 'trending':
        this.generateTrendingSections();
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

  generateBollywoodSections() {
    this.bollywoodSections = [
      {
        title: 'Trending Bollywood',
        fetch$: this.tmdbDiscover.discoverMovies({
          with_original_language: 'hi',
          with_origin_country: 'IN',
          sort_by: 'popularity.desc',
        }),
        type: 'movie',
        items: []
      },
      {
        title: 'Top Rated Hindi',
        fetch$: this.tmdbDiscover.discoverMovies({
          with_original_language: 'hi',
          with_origin_country: 'IN',
          sort_by: 'vote_average.desc',
          'vote_count.gte': 300
        }),
        type: 'movie',
        items: []
      },
      {
        title: 'Upcoming Hindi',
        fetch$: this.tmdbDiscover.discoverMovies({
          with_original_language: 'hi',
          with_origin_country: 'IN',
          sort_by: 'popularity.desc',
          with_release_type: '2|3',
          'primary_release_date.gte': new Date().toISOString().split('T')[0],
          'primary_release_date.lte': new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0]
        }),
        type: 'movie',
        items: []
      }
    ];
  }

  generateTopRatedSections() {
    this.topRatedSections = [
      {
        title: 'Top Rated Movies',
        fetch$: this.tmdbMovies.getTopRatedMovies('en-US', 1),
        type: 'movie',
        items: []
      },
      {
        title: 'Top Rated TV Shows',
        fetch$: this.tmdbTv.getTopRatedTvShows('en-US', 1),
        type: 'tv',
        items: []
      }
    ];
  }

  generateTrendingSections() {
    this.trendingSections = [
      {
        title: 'Trending Movies',
        fetch$: this.tmdbTrending.getTrendingMovies('week'),
        type: 'movie',
        items: []
      },
      {
        title: 'Trending TV',
        fetch$: this.tmdbTrending.getTrendingTvShows('week'),
        type: 'tv',
        items: []
      }
    ];
  }

  generateActorSections() {
    this.actorSections = [
      {
        title: 'Trending Worldwide',
        fetch$: this.tmdbTrending.getTrendingPeople('week'),
        type: 'person',
        items: []
      },
      {
        title: 'Popular Actors',
        fetch$: this.tmdbPeople.getPopularPeople('en-US', 1),
        type: 'person',
        items: []
      },
      {
        title: 'Next Gen & Rising 🚀',
        fetch$: this.tmdbPeople.getPopularPeople('en-US', 2),
        type: 'person',
        items: []
      },
      {
        title: 'The G.O.A.T.s 🌟',
        fetch$: this.tmdbPeople.getPopularPeople('en-US', 3),
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
        fetch$: this.tmdbDiscover.discoverMovies({
          with_origin_country: 'IN',
          sort_by: 'popularity.desc',
          'vote_count.gte': 50
        }),
        type: 'movie',
        items: [],
        viewAllRoute: `/view-all/trending-pan-india`
      },
      {
        title: `New ${langLabel} Releases`,
        fetch$: this.tmdbDiscover.discoverMovies({
          with_original_language: this.selectedLanguage,
          sort_by: 'primary_release_date.desc',
          'primary_release_date.lte': new Date().toISOString().split('T')[0],
          with_origin_country: 'IN',
          'vote_count.gte': 5 // Added this to prevent obscure results
        }),
        type: 'movie',
        items: [],
        viewAllRoute: `/view-all/new-releases/${this.selectedLanguage}`
      },
      {
        title: `Popular in ${langLabel}`,
        fetch$: this.tmdbDiscover.discoverMovies({
          with_original_language: this.selectedLanguage,
          sort_by: 'popularity.desc',
          with_origin_country: 'IN'
        }),
        type: 'movie',
        items: [],
        viewAllRoute: `/view-all/popular/${this.selectedLanguage}`
      },
      {
        title: `Top Rated ${langLabel}`,
        fetch$: this.tmdbDiscover.discoverMovies({
          with_original_language: this.selectedLanguage,
          sort_by: 'vote_average.desc',
          'vote_count.gte': 50,
          with_origin_country: 'IN'
        }),
        type: 'movie',
        items: [],
        viewAllRoute: `/view-all/top-rated/${this.selectedLanguage}`
      },
      {
        title: `${langLabel} Action Hits`,
        fetch$: this.tmdbDiscover.discoverMovies({
          with_original_language: this.selectedLanguage,
          with_genres: '28',
          sort_by: 'popularity.desc'
        }),
        type: 'movie',
        items: [],
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

        // Generate a unique cache key based on the segment and section tile to leverage Capacitor Cache
        const cacheKey = `discover_${this.segmentValue}_${this.selectedLanguage}_${section.title.replace(/\s+/g, '_')}`;

        this.legacySearchService.getWithCache(cacheKey, section.fetch$)
          .subscribe({
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
        if (index === 0 && section.items.length > 0) {
          this.initHeroRotation(section.items, section.type);
        }
      }
    });

    if (pendingCalls === 0) this.isLoading = false;
  }

  private getHeroBackdropUrl(item: any): string {
    if (item.known_for && item.known_for.length > 0 && item.known_for[0].backdrop_path) {
      return 'https://image.tmdb.org/t/p/original' + item.known_for[0].backdrop_path;
    }
    return 'https://image.tmdb.org/t/p/original' + (item.backdrop_path || item.poster_path);
  }

  private initHeroRotation(items: any[], type: 'movie' | 'tv' | 'person') {
    if (!items || items.length === 0) return;

    if (type === 'person') {
      this.validHeroItems = items.filter(p => p.known_for && p.known_for.length > 0 && p.known_for[0].backdrop_path);
    } else {
      this.validHeroItems = items.filter(i => !!i.backdrop_path);
    }

    if (this.validHeroItems.length === 0) {
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