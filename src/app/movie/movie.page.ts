import { Component, OnInit } from '@angular/core';
import { 
  IonContent, 
  IonSegment, 
  IonSegmentButton, 
  IonLabel, 
  IonFabButton, 
  IonFab, 
  IonIcon, IonCard, IonCardContent } from "@ionic/angular/standalone";
import { HeaderComponent } from '../header/header.component';
import { Router } from '@angular/router';
import { add, bookmark, bookmarksOutline, checkmarkDone } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AnimationService } from 'src/services/animation.service';

@Component({
  selector: 'app-movie',
  templateUrl: 'movie.page.html',
  styleUrls: ['movie.page.scss'],
  imports: [IonCardContent, IonCard, 
    FormsModule,
    CommonModule,
    IonIcon, 
    IonFab, 
    IonFabButton,
    IonLabel,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent
  ],
})
export class MoviePage implements OnInit {
  animateOnce = true;
  segment: string = 'watchlist';
  genres: string[] = ['Action', 'Drama', 'Comedy', 'Sci-Fi'];
  watchlist: GenreMap = {
    Action: [
      { title: 'John Wick', year: 2023 },
      { title: 'The Dark Knight', year: 2008 },
      { title: 'Taken', year: 2008 },
      { title: 'Skyfall', year: 2012 },
      { title: 'Black Panther', year: 2018 },
      { title: 'Avengers: Endgame', year: 2019 },
    ],
    Drama: [
      { title: 'The Shawshank Redemption', year: 1994 },
      { title: 'Forrest Gump', year: 1994 },
      { title: 'A Beautiful Mind', year: 2001 },
      { title: '12 Years a Slave', year: 2013 },
      { title: 'The Green Mile', year: 1999 },
      { title: 'The Pursuit of Happyness', year: 2006 },
      { title: 'Titanic', year: 1997 },
      { title: 'The Imitation Game', year: 2014 },      
    ],
    Comedy: [
      { title: 'The Mask', year: 1994 },
      { title: 'Dumb and Dumber', year: 1994 },
      { title: 'The Hangover', year: 2009 },
      { title: 'The Intern', year: 2015 },
      { title: 'Crazy Rich Asians', year: 2018 },
      { title: 'Game Night', year: 2018 },
      { title: 'Jumanji: Welcome to the Jungle', year: 2017 },
    ],
    'Sci-Fi': [
      { title: 'Interstellar', year: 2014 },
    ]
  };
  
  watched: GenreMap = {
    Action: [
      { title: 'Mad Max: Fury Road', year: 2015 },
    ],
    Comedy: [
      { title: 'Zombieland', year: 2009 },
      { title: 'Napoleon Dynamite', year: 2004 },
      { title: 'Free Guy', year: 2021 },
    ],
    'Sci-Fi': [
      { title: 'The Matrix', year: 1999 },
      { title: 'Oblivion', year: 2013 },
      { title: 'Looper', year: 2012 },
      { title: 'Minority Report', year: 2002 },
      { title: 'Elysium', year: 2013 },
      { title: 'Ex Machina', year: 2015 },
      { title: 'The Hunger Games', year: 2012 },
    ]
  };  

  constructor(
    private router: Router,
    private animationService: AnimationService
  ) {
    addIcons({ add, bookmark, checkmarkDone });
  }
  ngOnInit(): void {
    this.animateOnce = !this.animationService.moviesAnimated;

    if (!this.animationService.moviesAnimated) {
      this.animationService.moviesAnimated = false;
    }
  }

  goToSearch() {
    this.router.navigate(['/search']);
  }

  getCurrentList(): GenreMap {
    return this.segment === 'watchlist' ? this.watchlist : this.watched;
  }

  goToMovieDetail(id: number | string) {
    this.router.navigate(['/movie-detail', id]);
  }
}

type MovieItem = { title: string; year: number };

// Add this type to allow any genre string key
type GenreMap = { [genre: string]: MovieItem[] };