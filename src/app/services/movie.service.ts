import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { MovieDetails, RecommendationsResult } from 'src/app/models/movie-details.model';

@Injectable({
  providedIn: 'root',
})
export class MovieService {
  private readonly API_URL = 'https://api.themoviedb.org/3/discover/movie';
  private readonly SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';
  private readonly MOVIE_DETAILS_URL = 'https://api.themoviedb.org/3/movie';

  public watchlist: RecommendationsResult[] = [];
  public watched: RecommendationsResult[] = [];

  constructor(private http: HttpClient) {}

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
   * Search movies based on a query string.
   * @param query The search term to use.
   * @returns Observable containing search results.
   */
  searchMovies(query: string): Observable<any> {
    const url = `${this.SEARCH_URL}?query=${encodeURIComponent(query)}&include_adult=false`;
    const headers = new HttpHeaders({
      accept: 'application/json',
      Authorization: environment.apiKey,
    });
    return this.http.get<any>(url, { headers });
  }

  /**
   * Fetch detailed information for a single movie.
   * @param movieId The ID of the movie to fetch.
   * @returns Observable containing movie details.
   */
  getMovieDetails(movieId: number): Observable<MovieDetails> {
    const url = `${this.MOVIE_DETAILS_URL}/${movieId}?append_to_response=videos,providers,recommendations,reviews&language=en-US`;
    const headers = new HttpHeaders({
      accept: 'application/json',
      Authorization: environment.apiKey,
    });
    return this.http.get<MovieDetails>(url, { headers });
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
