import { Component } from '@angular/core';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {

  constructor() { }

  movies = [
    { title: 'Inception', poster: 'assets/inception.jpg' },
    { title: 'Breaking Bad', poster: 'assets/breaking_bad.jpg' },
    { title: 'Stranger Things', poster: 'assets/stranger_things.jpg' },
    { title: 'Dark', poster: 'assets/dark.jpg' },
    { title: 'Interstellar', poster: 'assets/interstellar.jpg' }
  ];
}
