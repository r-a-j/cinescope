import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { RecommendationsResult } from 'src/app/models/movie-details.model';

@Injectable({
    providedIn: 'root',
})
export class MovieService {
    private readonly API_URL = 'https://api.themoviedb.org/3/discover/movie';
    public watchlist: RecommendationsResult[] = [];
    public watched: RecommendationsResult[] = [];

    constructor(private http: HttpClient) { }

    /**
     * Fetch movies from The Movie Database API.
     * @param page Optional page number for pagination (default is 1)
     * @returns Observable containing movie data
     */
    getMovies(page: number = 1): Observable<any> {
        const url = `${this.API_URL}?include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc`;
        const headers = new HttpHeaders({
            accept: 'application/json',
            Authorization: environment.apiKey,
        });
        return this.http.get<any>(url, { headers });
    }

    /**
     * Adds a movie to the watchlist if it does not already exist.
     * @param movie The movie to add
     */
    addToWatchlist(movie: RecommendationsResult): void {
        if (!this.watchlist.some(m => m.id === movie.id)) {
            this.watchlist.push(movie);
        }
    }

    /**
     * Moves a movie from the watchlist to the watched list.
     * @param movie The movie to move
     */
    moveToWatched(movie: RecommendationsResult): void {
        // Remove from watchlist if exists
        this.watchlist = this.watchlist.filter(m => m.id !== movie.id);
        if (!this.watched.some(m => m.id === movie.id)) {
            this.watched.push(movie);
        }
    }
}
