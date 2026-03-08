import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbPaginatedResponseDto } from '../../models/tmdb/common/paginated-response.dto';
import { TmdbMovieListItemDto } from '../../models/tmdb/movies/movie-list-item.dto';
import { TmdbDiscoverMovieParamsDto } from '../../models/tmdb/discover/discover-movie-params.dto';
import { TmdbDiscoverTvParamsDto } from '../../models/tmdb/discover/discover-tv-params.dto';
import { TmdbTvListItemDto } from '../../models/tmdb/tv/tv-list-item.dto';

@Injectable({ providedIn: 'root' })
export class TmdbDiscoverService {
    constructor(private http: HttpClient) { }

    /**
     * Find movies using over 30 filters and sort options.
     * This is the core engine for CINESCOPE's advanced filtering.
     * * @param params The strictly typed query parameters.
     */
    discoverMovies(params: TmdbDiscoverMovieParamsDto = {}): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        const httpParams = this.buildHttpParams(params);

        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>('/discover/movie', {
            params: httpParams
        });
    }

    /**
     * Find TV shows using over 30 filters and sort options.
     * Crucial for CINESCOPE's TV-specific smart features.
     */
    discoverTv(params: TmdbDiscoverTvParamsDto = {}): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        const httpParams = this.buildHttpParams(params);
        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>('/discover/tv', {
            params: httpParams
        });
    }

    /**
     * Safely converts the DTO object into Angular HttpParams, 
     * dropping any undefined, null, or empty string values.
     */
    private buildHttpParams(params: any): HttpParams {
        let httpParams = new HttpParams();

        Object.keys(params).forEach(key => {
            const value = params[key];
            if (value !== undefined && value !== null && value !== '') {
                // Angular's HttpParams requires string values
                httpParams = httpParams.set(key, value.toString());
            }
        });

        return httpParams;
    }

    //     // Example: The "Zero Brain Cells Left" (Fast-paced, high action, short runtime)
    // Why this architecture is powerful for CINESCOPE:
    // With this setup, building your "My Wallet Filter" or "Zero Brain Cells Left" features becomes incredibly simple in your Domain / Adapter layer later:
    // this.discoverService.discoverMovies({
    //     with_genres: '28', // Action
    //     'with_runtime.lte': 100, // Under 100 mins
    //     sort_by: 'popularity.desc',
    //     'vote_count.gte': 500
    // });

    // // Example: "My Wallet Filter" (Only show free/subscription movies in the US)
    // this.discoverService.discoverMovies({
    //     watch_region: 'US',
    //     with_watch_monetization_types: 'flatrate', // Subscriptions only
    //     with_watch_providers: '8|9' // e.g., Netflix OR Amazon Prime
    // });
}