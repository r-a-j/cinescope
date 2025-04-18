import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonFabButton,
  IonFab,
  IonIcon, IonCardContent, IonImg, IonCol, IonRow, IonGrid, IonCardHeader, IonCardTitle, IonCard,
  Platform
} from "@ionic/angular/standalone";
import { HeaderComponent } from '../header/header.component';
import { NavigationEnd, Router } from '@angular/router';
import { add, bookmark, checkmarkDone } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StorageService } from 'src/services/storage.service';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { filter, firstValueFrom, Subscription } from 'rxjs';
import { ContentModel } from 'src/models/content.model';
import * as movieGenres from 'src/assets/movie_genres.json';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-movie',
  templateUrl: 'movie.page.html',
  styleUrls: ['movie.page.scss'],
  imports: [IonCard, IonCardTitle, IonCardHeader, IonGrid, IonRow, IonCol, IonImg, IonCardContent,
    FormsModule,
    CommonModule,
    IonIcon,
    IonFab,
    IonFabButton,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent
  ],
})
export class MoviePage implements OnInit, OnDestroy {

  segment: string = 'watchlist';
  watchlist: MovieDetailModel[] = [];
  watched: MovieDetailModel[] = [];  
  private storageSub!: Subscription;
  private routerSubscription: any;


  constructor(
    private router: Router,
    private storageService: StorageService,
    private tmdbService: TmdbSearchService,
    private navCtrl: NavController,
    private platform: Platform
  ) {
    addIcons({ add, bookmark, checkmarkDone });
  }
  
  
  ngOnInit() {
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.urlAfterRedirects.includes('tabs/movie')) {  // adjust the route if needed
          console.log('I am back on Movie Page!');
          this.loadMovies();
        }
      });
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
  }

  // ionViewWillEnter() {
  //   // Subscribe to storage changes
  //   this.storageSub = this.storageService.storageChanged$.subscribe(() => {
  //     this.loadMovies();
  //   });
  // }

  async loadMovies() {
    // Clear the movies array before loading new data
    this.watchlist = [];

    // Load the watchlist
    const savedItems = await this.storageService.getWatchlist();

    // Create a set of unique movie IDs to prevent duplicates
    const uniqueSavedItems = Array.from(new Set(savedItems.map(item => item.contentId)))
      .map(id => savedItems.find(item => item.contentId === id))
      .filter((item): item is ContentModel => item !== undefined); // Filters out undefined values

    const promises = uniqueSavedItems.map(async (item) => {
      try {
        const movieDetail = await firstValueFrom(this.tmdbService.getMovieDetail(item.contentId));

        const movieItem: MovieDetailModel = {
          id: movieDetail?.id,
          title: movieDetail?.title,
          poster_path: movieDetail?.poster_path,
        };

        // Directly add to the movies array
        this.watchlist.push(movieItem);

      } catch (error) {
        console.error('Failed to fetch movie', item.contentId, error);
      }
    });

    await Promise.all(promises); // Wait for all movies to load
  }

  goToSearch() {    
    this.router.navigate(['/search']);    
  }

  goToMovieDetail(id?: number | string) {
    this.router.navigate(['/movie-detail', id]);
  }
}