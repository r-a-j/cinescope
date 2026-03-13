import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TmdbPaginatedResponseDto } from '../dtos/common/paginated-response.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { TmdbPersonListItemDto } from '../dtos/people/person-list-item.dto';
import { TmdbTrendingMixedItemDto } from '../dtos/trending/trending-mixed-item.dto';
import { BaseMediaService } from './base-media.service';

@Injectable({ providedIn: 'root' })
export class TmdbTrendingService extends BaseMediaService {
    // Pro-Tip for CINESCOPE
    // If you look closely at the Trending People JSON response in your documentation, each person object contains a known_for array containing their top 3 movies or TV shows.

    // When you build a "Trending Actors This Week" UI row, you don't just have to show their face. You can overlay the title of their top known_for project directly onto their profile image. This instantly answers the user's subconscious question: "Why is this person trending right now?" without them having to tap anything!  

    /**
     * Get the trending movies, TV shows and people in a single combined list.
     * * @productContext
     * - Scenario 174 (The "Watercooler Radar"): Use this endpoint with the 'week' parameter to power the main hero carousel on the home screen, mixing all media types into one premium feed.
     * 
     * -   **The Problem:** Users want to stay culturally relevant and know what everyone is talking about at the office or on social media, but they don't want to dig through different categories.
    
    -   **The Feature:** By hitting the `Trending All` endpoint with the `week` parameter, CINESCOPE populates a massive hero carousel at the very top of the home screen called _"The Watercooler"_. It mixes the biggest blockbuster movie, the hottest new TV pilot, and the most viral actor of the week into one frictionless feed.
     * * @param timeWindow 'day' or 'week'.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     */
    getTrendingAll(
        timeWindow: 'day' | 'week' = 'day',
        language = 'en-US'
    ): Observable<TmdbPaginatedResponseDto<TmdbTrendingMixedItemDto>> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbPaginatedResponseDto<TmdbTrendingMixedItemDto>>(`${this.apiPrefix}/trending/all/${timeWindow}`, { params });
    }

    /**
     * Get the trending movies on TMDB.
     * * @productContext
     * - Scenario 175 ("The Daily Pulse"): Swap the `timeWindow` parameter to 'day' on weekdays to show fast-moving viral movies, and switch to 'week' on Friday nights for curated weekend binging.
     * -   **The Problem:** User behavior changes depending on the day. On Tuesday, they want quick updates on what's going viral. On Friday night, they want proven, stable hits to invest their weekend into.
     * -   **The Feature:** CINESCOPE dynamically alters its API calls based on the day of the week. On weekdays, the app uses the `day` time window to show highly volatile, viral content. On Friday evenings, it silently switches to the `week` time window to provide a more stable, curated list of the week's biggest hits.
     * * @param timeWindow 'day' or 'week'.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     */
    getTrendingMovies(
        timeWindow: 'day' | 'week' = 'day',
        language = 'en-US'
    ): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>(`${this.apiPrefix}/trending/movie/${timeWindow}`, { params });
    }

    /**
     * Get the trending TV shows on TMDB.
     * * @param timeWindow 'day' or 'week'.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     */
    getTrendingTvShows(
        timeWindow: 'day' | 'week' = 'day',
        language = 'en-US'
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/trending/tv/${timeWindow}`, { params });
    }

    /**
     * Get the trending people on TMDB.
     * * @param timeWindow 'day' or 'week'.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     */
    getTrendingPeople(
        timeWindow: 'day' | 'week' = 'day',
        language = 'en-US'
    ): Observable<TmdbPaginatedResponseDto<TmdbPersonListItemDto>> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbPaginatedResponseDto<TmdbPersonListItemDto>>(`${this.apiPrefix}/trending/person/${timeWindow}`, { params });
    }
}