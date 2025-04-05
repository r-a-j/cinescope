import { Component } from '@angular/core';
import { 
  IonContent, 
  IonSegment, 
  IonSegmentButton, 
  IonLabel 
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tv',
  templateUrl: 'tv.page.html',
  styleUrls: ['tv.page.scss'],
  imports: [
    FormsModule,
    CommonModule,
    IonLabel,
    IonSegmentButton,
    IonSegment,
    IonContent,
    HeaderComponent
  ],
})
export class TvPage {

  segment: string = 'watchlist';
  Object = Object;

  watchlist: GenreMap = {
    Action: [
      { title: '24', year: 2001, image: 'assets/placeholder.png' },
      { title: 'Arrow', year: 2012, image: 'assets/placeholder.png' },
      { title: 'The Mandalorian', year: 2019, image: 'assets/placeholder.png' }
    ],
    Drama: [
      { title: 'Breaking Bad', year: 2008, image: 'assets/placeholder.png' },
      { title: 'The Crown', year: 2016, image: 'assets/placeholder.png' }
    ],
    Mystery: [
      { title: 'Dark', year: 2017, image: 'assets/placeholder.png' },
      { title: 'Sherlock', year: 2010, image: 'assets/placeholder.png' }
    ],
    Fantasy: [
      { title: 'The Witcher', year: 2019, image: 'assets/placeholder.png' },
      { title: 'Game of Thrones', year: 2011, image: 'assets/placeholder.png' }
    ]
  };

  watched: GenreMap = {
    Action: [
      { title: 'Prison Break', year: 2005, image: 'assets/placeholder.png' },
      { title: 'Jack Ryan', year: 2018, image: 'assets/placeholder.png' }
    ],
    Drama: [
      { title: 'The Sopranos', year: 1999, image: 'assets/placeholder.png' },
      { title: 'This Is Us', year: 2016, image: 'assets/placeholder.png' }
    ],
    SciFi: [
      { title: 'Stranger Things', year: 2016, image: 'assets/placeholder.png' },
      { title: 'Westworld', year: 2016, image: 'assets/placeholder.png' }
    ]
  };

  constructor(private router: Router) { }

  get genres(): string[] {
    return this.segment === 'watchlist' ? Object.keys(this.watchlist) : Object.keys(this.watched);
  }

  getShowsByGenre(genre: string): TVShow[] {
    return this.segment === 'watchlist' ? this.watchlist[genre] : this.watched[genre];
  }

  goToTvDetail(id: number | string) {
    this.router.navigate(['/tv-detail', id]);
  }
}

interface TVShow {
  title: string;
  year: number;
  image: string;
}
type GenreMap = { [genre: string]: TVShow[] };
