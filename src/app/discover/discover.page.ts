import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonToolbar, IonSegmentButton, IonLabel, IonSegment, IonChip } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { MediaCarouselComponent } from '../shared/components/media-carousel/media-carousel.component';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { Observable } from 'rxjs';

interface DiscoverSection {
  title: string;
  method: string;
  viewAllRoute?: string;
  type: 'movie' | 'tv' | 'person'; // Added person
  items: any[];
}

@Component({
  selector: 'app-discover',
  templateUrl: 'discover.page.html',
  styleUrls: ['discover.page.scss'],
  standalone: true,
  imports: [
    IonLabel,
    IonChip,
    IonSegment,
    IonSegmentButton,
    IonToolbar,
    IonContent,
    CommonModule,
    FormsModule,
    HeaderComponent,
    MediaCarouselComponent
  ],
})
export class DiscoverPage implements OnInit {
  segmentValue: string = 'bollywood';
  isLoading: boolean = false;

  // Configuration for each segment
  bollywoodSections: DiscoverSection[] = [
    { title: 'Trending Desi Movies', method: 'getTrendingBollywoodMovies', viewAllRoute: '/bollywood-trending', type: 'movie', items: [] },
    { title: 'Upcoming Desi Movies', method: 'getUpcomingMovies', viewAllRoute: '', type: 'movie', items: [] }
  ];

  topRatedSections: DiscoverSection[] = [
    { title: 'Top Rated Movies', method: 'getTopRatedMovies', viewAllRoute: '/top-rated-movies', type: 'movie', items: [] },
    { title: 'Top Rated TV Shows', method: 'getTopRatedTV', viewAllRoute: '/top-rated-tv', type: 'tv', items: [] }
  ];

  trendingSections: DiscoverSection[] = [
    { title: 'Trending Movies (Global)', method: 'getTrendingMovies', type: 'movie', items: [] },
    { title: 'Trending TV (Global)', method: 'getTrendingTv', type: 'tv', items: [] }
  ];

  actorSections: DiscoverSection[] = [
    { title: 'Popular Actors', method: 'getPopularPersons', type: 'person', items: [] }
  ];

  // Desi Hub Configuration
  selectedLanguage: string = 'all';
  languageChips = [
    { label: 'All India', value: 'all' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Telugu', value: 'te' },
    { label: 'Tamil', value: 'ta' },
    { label: 'Malayalam', value: 'ml' },
    { label: 'Kannada', value: 'kn' }
  ];

  desiSections: DiscoverSection[] = [
    { title: 'Trending in India', method: 'getTrendingIndia', type: 'movie', items: [] },
    { title: 'In Theaters', method: 'getIndianTheatrical', type: 'movie', items: [] },
    { title: 'Regional Hits', method: 'getDiscoverIndian', type: 'movie', items: [] }
  ];

  constructor(private tmdbService: TmdbSearchService) { }

  ngOnInit() {
    this.loadSegmentData();
  }

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
    this.loadSegmentData();
  }

  languageChanged(lang: string) {
    this.selectedLanguage = lang;
    // Reload only the necessary sections for Desi Hub
    this.loadDesiData();
  }

  get currentSections(): DiscoverSection[] {
    switch (this.segmentValue) {
      case 'bollywood': return this.bollywoodSections;
      case 'topRated': return this.topRatedSections;
      case 'trending': return this.trendingSections;
      case 'actors': return this.actorSections;
      case 'desi': return this.desiSections;
      default: return [];
    }
  }

  loadSegmentData() {
    switch (this.segmentValue) {
      case 'bollywood':
        this.loadSections(this.bollywoodSections);
        break;
      case 'topRated':
        this.loadSections(this.topRatedSections);
        break;
      case 'trending':
        this.loadSections(this.trendingSections);
        break;
      case 'actors':
        this.loadSections(this.actorSections);
        break;
      case 'desi':
        this.loadDesiData();
        break;
    }
  }

  loadDesiData() {
    // Custom loading for Desi Hub because it might use specific params (language)
    this.desiSections.forEach(section => {
      let method = section.method;
      let methodArgs: any[] = [];

      if (method === 'getDiscoverIndian') {
        methodArgs = [1, this.selectedLanguage];
      }

      if (this.tmdbService[method as keyof TmdbSearchService]) {
        // @ts-ignore
        (this.tmdbService[method](...methodArgs) as Observable<any>).subscribe({
          next: (data: any) => {
            // console.log(`Loaded ${section.title}`, data);
            section.items = data.results || [];
          },
          error: (err) => console.error(`Error loading ${section.title}`, err)
        });
      }
    });
  }

  private loadSections(sections: DiscoverSection[]) {
    sections.forEach(section => {
      if (section.items.length === 0) {
        const method = section.method;
        if (this.tmdbService[method as keyof TmdbSearchService]) {
          // @ts-ignore
          (this.tmdbService[method]() as Observable<any>).subscribe({
            next: (data: any) => {
              section.items = data.results;
            },
            error: (err) => console.error(`Error loading ${section.title}`, err)
          });
        }
      }
    });
  }
}
