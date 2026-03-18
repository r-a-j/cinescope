import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbGenreListDto } from '../dtos/genres/genre.dto';
import { BaseMediaService } from './base-media.service';

@Injectable({ providedIn: 'root' })
export class TmdbGenresService extends BaseMediaService {
    /**
     * Get the list of official genres for movies.
     * @param language Optional ISO 639-1 language code (defaults to 'en').
     * This endpoint is the key to unlocking Scenario 7: The "Compromise Argument" (The Venn Diagram Feature).
     */
    getMovieGenres(language = 'en'): Observable<TmdbGenreListDto> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbGenreListDto>(`${this.apiPrefix}/genre/movie/list`, { params });
    }

    // When Partner A and Partner B tap their phones together, your app can pull their respective 
    // TmdbGenreListDto preferences. If Partner A heavily watches id: 10749 (Romance) and Partner B
    //  heavily watches id: 28 (Action), your Discover API service can instantly fire a query with 
    // with_genres = 10749, 28 to find the exact mathematical center of their tastes.

    // Furthermore, like the Configuration data, the official list of TMDB genres rarely changes.
    // You should fetch this once on app startup, cache it locally in your StorageService, and use it as 
    // an in -memory dictionary to translate the genre_ids found in your BaseMediaPage views.

    /**
     * Get the list of official genres for TV shows.
     * @param language Optional ISO 639-1 language code (defaults to 'en').
     */
    getTvGenres(language = 'en'): Observable<TmdbGenreListDto> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbGenreListDto>(`${this.apiPrefix}/genre/tv/list`, { params });

        // Notice how TV genres differ slightly from Movie genres(e.g., TV has "Sci-Fi & Fantasy" 
        // combined as 10765, whereas Movies split them into 878 and 14).

        // When you build your UI Filter Sidebar later(like the one we saw in your BaseMediaPage class), 
        // make sure your app fetches the correct genre dictionary depending on whether the user is 
        // currently viewing the "Movies" tab or the "TV Shows" tab!
    }
}