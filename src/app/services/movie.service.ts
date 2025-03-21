import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, Observable, of, throwError } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { MovieDetails } from 'src/app/models/movie-details.model';
import { StorageService } from './storage.service';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root',
})
export class MovieService {
  private readonly API_URL = 'https://api.themoviedb.org/3/discover/movie';
  private readonly SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';
  private readonly MOVIE_DETAILS_URL = 'https://api.themoviedb.org/3/movie';

  constructor(
    private http: HttpClient,
    private storage: StorageService,
    private toastController: ToastController,
  ) { }

  /**
   * Helper method to retrieve the API key from storage and return HttpHeaders.
   */
  private getAuthHeaders(): Observable<HttpHeaders> {
    return from(this.storage.getSetting('tmdbApiKey')).pipe(
      switchMap(apiKey => {
        if (!apiKey) {
          return throwError(() => new Error('No API key found in database'));
        }
        const fullApiKey = `Bearer ${apiKey}`;
        const headers = new HttpHeaders({
          accept: 'application/json',
          Authorization: fullApiKey,
        });
        return of(headers);
      }),
      tap({
        error: () => {
          // Show the toast only if there was an error.
          this.toastController.create({
            message: 'API Key Missing - Add in settings',
            duration: 3000,
            position: 'top',
            color: 'danger',
          }).then(toast => toast.present());
        }
      })
    );
  }

  /**
   * Helper method to retrieve allowAdultContent setting.
   */
  private getAdultParam(): Observable<string> {
    return from(this.storage.getSetting('allowAdultContent')).pipe(
      switchMap(allow => {
        // If setting is not set, default to "false"
        const includeAdult = (allow && allow.toLowerCase() === 'true') ? 'true' : 'false';
        return of(includeAdult);
      })
    );
  }

  /**
   * Fetch movies from The Movie Database API.
   * @param page Optional page number for pagination (default is 1)
   * @returns Observable containing movie data.
   */
  getMovies(page: number = 1): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => {
        return this.getAdultParam().pipe(
          switchMap(includeAdult => {
            const url = `${this.API_URL}?include_adult=${includeAdult}&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc`;
            return this.http.get<any>(url, { headers });
          })
        );
      })
    );
  }

  /**
   * Search movies based on a query string.
   * @param query The search term to use.
   * @returns Observable containing search results.
   */
  searchMovies(query: string): Observable<any> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => {
        return this.getAdultParam().pipe(
          switchMap(includeAdult => {
            const url = `${this.SEARCH_URL}?query=${encodeURIComponent(query)}&include_adult=${includeAdult}`;
            return this.http.get<any>(url, { headers });
          })
        );
      })
    );
  }

  /**
   * Fetch detailed information for a single movie.
   * @param movieId The ID of the movie to fetch.
   * @returns Observable containing movie details.
   */
  getMovieDetails(movieId: number): Observable<MovieDetails> {
    return this.getAuthHeaders().pipe(
      switchMap(headers => {
        const url = `${this.MOVIE_DETAILS_URL}/${movieId}?append_to_response=videos,providers,recommendations,reviews&language=en-US`;
        return this.http.get<MovieDetails>(url, { headers });
      })
    );
  }

  /**
   * Adds a movie (full details) to the watchlist in the database.
   * Ensures the movie is not present in the watched list.
   */
  async addToWatchlist(movie: MovieDetails): Promise<void> {
    // Ensure the movie is not in the watched list.
    await this.storage.removeMovieFromList(movie, 'watched');
    await this.storage.addMovieToList(movie, 'watchlist');
  }

  /**
   * Moves a movie from the watchlist to the watched list in the database.
   * Ensures the movie is not present in both lists.
   */
  async moveToWatched(movie: MovieDetails): Promise<void> {
    await this.storage.removeMovieFromList(movie, 'watchlist');
    await this.storage.addMovieToList(movie, 'watched');
  }

  /**
   * Retrieves the current watchlist from the database.
   */
  async getWatchlist(): Promise<MovieDetails[]> {
    return await this.storage.getWatchlist();
  }

  /**
   * Retrieves the current watched list from the database.
   */
  async getWatched(): Promise<MovieDetails[]> {
    return await this.storage.getWatchedList();
  }
}
