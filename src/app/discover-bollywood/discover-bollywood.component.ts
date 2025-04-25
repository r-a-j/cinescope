import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DiscoverBollywoodUpcomingMoviesComponent } from '../discover-bollywood-upcoming-movies/discover-bollywood-upcoming-movies.component';
import { DiscoverBollywoodTrendingMoviesComponent } from '../discover-bollywood-trending-movies/discover-bollywood-trending-movies.component';

@Component({
  selector: 'app-discover-bollywood',
  templateUrl: './discover-bollywood.component.html',
  styleUrls: ['./discover-bollywood.component.scss'],
  imports: [
    CommonModule,
    DiscoverBollywoodUpcomingMoviesComponent,
    DiscoverBollywoodTrendingMoviesComponent
  ],
  standalone: true,
})
export class DiscoverBollywoodComponent {
  constructor() { }
}
