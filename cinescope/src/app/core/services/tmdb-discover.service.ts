import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TmdbPaginatedResponseDto } from '../dtos/common/paginated-response.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbDiscoverMovieParamsDto } from '../dtos/discover/discover-movie-params.dto';
import { TmdbDiscoverTvParamsDto } from '../dtos/discover/discover-tv-params.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { BaseMediaService } from './base-media.service';


@Injectable({ providedIn: 'root' })
export class TmdbDiscoverService extends BaseMediaService {
    /**
     * Find movies using over 30 filters and sort options.
     * This is the core engine for CINESCOPE's advanced filtering.
     * * @param params The strictly typed query parameters.
     */
    discoverMovies(params: TmdbDiscoverMovieParamsDto = {}): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        // 1. Define the default fallback parameters
        const defaults: TmdbDiscoverMovieParamsDto = {
            include_adult: false,
            include_video: false,
            language: 'en-US',
            page: 1,
            sort_by: 'popularity.desc',
        };

        // 2. Merge user params over the defaults
        const mergedParams = { ...defaults, ...params };

        // 3. Use the inherited base method to safely build Angular HttpParams
        const httpParams = this.buildParams(mergedParams as Record<string, string | number | boolean | undefined | null>);

        // 4. Execute the call safely
        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>(`${this.apiPrefix}/discover/movie`, { params: httpParams });
    }

    /**
     * Find TV shows using over 30 filters and sort options.
     * Crucial for CINESCOPE's TV-specific smart features.
     */
    discoverTv(params: TmdbDiscoverTvParamsDto = {}): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        // 1. Define TV-specific default fallbacks
        const defaults: TmdbDiscoverTvParamsDto = {
            include_adult: false,
            language: 'en-US',
            page: 1,
            sort_by: 'popularity.desc',
        };

        // 2. Merge user params over the defaults
        const mergedParams = { ...defaults, ...params };

        // 3. Use the inherited BaseMediaService method to safely build Angular HttpParams
        const httpParams = this.buildParams(mergedParams as Record<string, string | number | boolean | undefined | null>);

        // 4. Execute the strictly-typed call
        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/discover/tv`, {
            params: httpParams
        });
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