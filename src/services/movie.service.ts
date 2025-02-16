import { Injectable } from '@angular/core';
import { RecommendationsResult } from 'src/models/movie-details.model';

@Injectable({
    providedIn: 'root',
})
export class MovieService {
    watchlist: RecommendationsResult[] = [];
    watched: RecommendationsResult[] = [];

    constructor() { }

    addToWatchlist(movie: RecommendationsResult) {
        if (!this.watchlist.some(m => m.id === movie.id)) {
            this.watchlist.push(movie);
        }
    }

    moveToWatched(movie: RecommendationsResult) {
        // Remove from watchlist if exists
        this.watchlist = this.watchlist.filter(m => m.id !== movie.id);
        if (!this.watched.some(m => m.id === movie.id)) {
            this.watched.push(movie);
        }
    }
}
