import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { retry, catchError, finalize } from 'rxjs/operators';
import { TmdbDiscoverService } from '../../core/services/tmdb-discover.service';
import { TmdbMovieListItemDto } from '../../core/dtos/movies/movie-list-item.dto';
import { TmdbPaginatedResponseDto } from '../../core/dtos/common/paginated-response.dto';

@Component({
    selector: 'app-discover-feed',
    standalone: true,
    imports: [CommonModule],
    templateUrl: 'discover-feed.component.html',
    styleUrls: ['discover-feed.component.scss']
})
export class DiscoverFeedComponent implements OnInit {
    // 1. Inject our decoupled service
    private discoverService = inject(TmdbDiscoverService);

    // 2. Define the exact UI State Machine using strictly-typed WritableSignals
    public movies: WritableSignal<TmdbMovieListItemDto[]> = signal<TmdbMovieListItemDto[]>([]);
    public isLoading: WritableSignal<boolean> = signal<boolean>(true);
    public hasError: WritableSignal<boolean> = signal<boolean>(false);
    public isEmpty: WritableSignal<boolean> = signal<boolean>(false);

    ngOnInit(): void {
        this.fetchFeed();
    }

    public fetchFeed(): void {
        // Reset states for a fresh call
        this.isLoading.set(true);
        this.hasError.set(false);
        this.isEmpty.set(false);

        // Fire the request through our Vercel Proxy via the Interceptor
        this.discoverService.discoverMovies({ sort_by: 'popularity.desc' })
            .pipe(
                retry(3),
                // ENTERPRISE FIX: Explicit return type on the catchError arrow function
                catchError((err: unknown): Observable<null> => {
                    console.error('[Network or API Error]:', err);
                    this.hasError.set(true);
                    return of(null);
                }),
                // ENTERPRISE FIX: Explicit return type on the finalize arrow function
                finalize((): void => this.isLoading.set(false))
            )
            // ENTERPRISE FIX: Explicit return type on the subscribe arrow function
            .subscribe((response: TmdbPaginatedResponseDto<TmdbMovieListItemDto> | null): void => {
                if (response && response.results) {
                    this.movies.set(response.results);
                    this.isEmpty.set(response.results.length === 0);
                }
            });
    }

    /**
     * Utility to construct the full TMDB image URL.
     */
    public getImageUrl(path: string | null): string {
        if (!path) {
            return 'assets/placeholder-poster.png';
        }
        return `https://image.tmdb.org/t/p/w500${path}`;
    }
}