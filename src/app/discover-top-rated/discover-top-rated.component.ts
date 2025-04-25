import { Component } from '@angular/core';
import { DiscoverTopRatedForeignMoviesComponent } from '../discover-top-rated-foreign-movies/discover-top-rated-foreign-movies.component';
import { DiscoverTopRatedForeignTvComponent } from '../discover-top-rated-foreign-tv/discover-top-rated-foreign-tv.component';
import { DiscoverTopRatedDesiMoviesComponent } from '../discover-top-rated-desi-movies/discover-top-rated-desi-movies.component';
import { DiscoverTopRatedDesiTvComponent } from '../discover-top-rated-desi-tv/discover-top-rated-desi-tv.component';

@Component({
  selector: 'app-discover-top-rated',
  templateUrl: './discover-top-rated.component.html',
  styleUrls: ['./discover-top-rated.component.scss'],
  imports: [
    DiscoverTopRatedForeignMoviesComponent,
    DiscoverTopRatedForeignTvComponent,
    DiscoverTopRatedDesiMoviesComponent,
    DiscoverTopRatedDesiTvComponent
  ],
  standalone: true,
})
export class DiscoverTopRatedComponent {
  constructor() { }
}
