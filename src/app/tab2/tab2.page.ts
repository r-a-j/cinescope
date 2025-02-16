import { Component } from '@angular/core';
import { RecommendationsResult } from 'src/models/movie-details.model';
import { MovieService } from 'src/services/movie.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {

  constructor(private movieService: MovieService) {}

  get watchedMovies(): RecommendationsResult[] {
    return this.movieService.watched;
  }
}
