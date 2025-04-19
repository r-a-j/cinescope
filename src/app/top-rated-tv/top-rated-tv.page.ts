import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-top-rated-tv',
  templateUrl: './top-rated-tv.page.html',
  styleUrls: ['./top-rated-tv.page.scss'],
  standalone: true,
  imports: [IonInfiniteScrollContent, IonInfiniteScroll,
    IonContent,
    CommonModule,
    FormsModule,
    HeaderComponent
  ],
})
export class TopRatedTvPage implements OnInit {

  tvShows = [
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    { title: 'One Piece', rating: 8.8, year: 1999 },
    { title: 'Rick and Morty', rating: 8.9, year: 2013 },
    // Add more data as needed
  ];

  constructor(private router: Router) { }

  ngOnInit() {
  }

  goToTvDetail(id: number | string) {
    this.router.navigate(['/tv-detail', id]);
  }

  loadMore(event: any) {
    setTimeout(() => {
      const newItems = [
        { title: 'New Show', rating: 8.5, year: 2020 },
        { title: 'Another Show', rating: 8.7, year: 2021 },
        { title: 'Show Again', rating: 9.0, year: 2022 },
        { title: 'Last Show', rating: 8.6, year: 2023 },
      ];
      this.tvShows.push(...newItems);
      event.target.complete();
    }, 1000);
  }

}
