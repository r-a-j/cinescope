import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonToolbar, IonSegmentButton, IonLabel, IonSegment } from '@ionic/angular/standalone';
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
    { title: 'Popular Actors', method: 'getPopularPersons', type: 'movie', items: [] } // Type movie used for route but might need adjustment
  ];

  constructor(private tmdbService: TmdbSearchService) { }

  ngOnInit() {
    this.loadAllSections();
  }

  segmentChanged(event: any): void {
    this.segmentValue = event.detail.value;
  }

  get currentSections(): DiscoverSection[] {
    switch (this.segmentValue) {
      case 'bollywood': return this.bollywoodSections;
      case 'topRated': return this.topRatedSections;
      case 'trending': return this.trendingSections;
      case 'actors': return this.actorSections;
      default: return [];
    }
  }

  private loadAllSections() {
    this.loadSections(this.bollywoodSections);
    this.loadSections(this.topRatedSections);
    this.loadSections(this.trendingSections);
    this.loadSections(this.actorSections);
  }

  private loadSections(sections: DiscoverSection[]) {
    sections.forEach(section => {
      const serviceCall = (this.tmdbService as any)[section.method](1);
      if (serviceCall instanceof Observable) {
        serviceCall.subscribe({
          next: (data: any) => {
            section.items = data.results;
          },
          error: (err) => console.error(`Error loading ${section.title}`, err)
        });
      }
    });
  }
}

