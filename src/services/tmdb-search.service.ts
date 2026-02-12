import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MovieSearchModel } from 'src/models/movie/movie-search.model';
import { TvSearchModel } from 'src/models/tv/tv-search.model';
import { MovieUpcomingModel } from 'src/models/movie/movie-upcoming.model';
import { buildDiscoverMovieUrl } from 'src/app/core/utils/discover-movie-url.builder';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';
import { PersonModel } from 'src/models/person.model';
import { MovieTopRatedModel } from 'src/models/movie/movie-top-rated.model';
import { TvTopRatedModelRoot } from 'src/models/tv/tv-top-rated.model';
import { TvDetailModel } from 'src/models/tv/tv-detail.model';
import { PersonDetailModel } from 'src/models/person-detail.model';
import { CacheService } from './cache.service';

@Injectable({ providedIn: 'root' })
export class TmdbSearchService {
    private BASE_URL = 'https://api.themoviedb.org/3';

    constructor(
        private http: HttpClient,
        private cacheService: CacheService
    ) { }

    /** Handle API errors */
    private handleError(error: any) {
        console.error('TMDB API Error:', error);
        return throwError(() => new Error('Something went wrong with the TMDB API.'));
    }

    /** Helper to check cache or fetch */
    private getWithCache<T>(key: string, fetch$: Observable<T>, ttl?: number): Observable<T> {
        return new Observable<T>(observer => {
            this.cacheService.get(key).then(cached => {
                if (cached) {
                    observer.next(cached);
                    observer.complete();
                } else {
                    fetch$.subscribe({
                        next: (data) => {
                            this.cacheService.set(key, data, ttl);
                            observer.next(data);
                            observer.complete();
                        },
                        error: (err) => observer.error(err)
                    });
                }
            });
        });
    }

    /** Search Movies */
    searchMovies(query: string, page = 1, year?: string, lang: string = 'en-US'): Observable<MovieSearchModel> {
        let params = new HttpParams()
            .set('query', query)
            .set('language', lang)
            .set('page', page);

        if (year) params = params.set('year', year);

        return this.http.get<MovieSearchModel>(`${this.BASE_URL}/search/movie`, { params })
            .pipe(catchError(this.handleError));
    }

    /** Search TV Shows */
    searchTV(query: string, page = 1, year?: string, lang: string = 'en-US'): Observable<TvSearchModel> {
        let params = new HttpParams()
            .set('query', query)
            .set('language', lang)
            .set('page', page);

        if (year) params = params.set('first_air_date_year', year);

        return this.http.get<TvSearchModel>(`${this.BASE_URL}/search/tv`, { params })
            .pipe(catchError(this.handleError));
    }

    /** Generic Trending Movies */
    getTrendingMovies(page: number = 1): Observable<MovieSearchModel> {
        const key = `trending_movie_${page}`;
        return this.getWithCache(key, this.http.get<MovieSearchModel>(`${this.BASE_URL}/trending/movie/week`, {
            params: new HttpParams().set('page', page).set('language', 'en-US')
        }).pipe(catchError(this.handleError)));
    }

    /** Generic Trending TV */
    getTrendingTv(page: number = 1): Observable<TvSearchModel> {
        const key = `trending_tv_${page}`;
        return this.getWithCache(key, this.http.get<TvSearchModel>(`${this.BASE_URL}/trending/tv/week`, {
            params: new HttpParams().set('page', page).set('language', 'en-US')
        }).pipe(catchError(this.handleError)));
    }

    /** Trending Bollywood Movies */
    getTrendingBollywoodMovies(page: number = 1): Observable<MovieSearchModel> {
        const key = `trending_bollywood_${page}`;
        const discoveryUrl = `${this.BASE_URL}/discover/movie`;
        const apiParams = new HttpParams()
            .set('include_video', 'true')
            .set('language', 'en-US')
            .set('primary_release_year', '2025')
            .set('sort_by', 'vote_average.desc')
            .set('with_origin_country', 'IN')
            .set('with_original_language', 'hi')
            .set('page', page);

        return this.getWithCache(key, this.http.get<MovieSearchModel>(discoveryUrl, { params: apiParams })
            .pipe(catchError(this.handleError)));
    }

    // --- Desi Hub Methods ---

    getTrendingIndia(page = 1): Observable<MovieSearchModel> {
        const key = `trending_india_v2_${page}`;
        // Using discover to force Indian content sorting by popularity
        return this.getWithCache(key, this.http.get<MovieSearchModel>(`${this.BASE_URL}/discover/movie`, {
            params: new HttpParams()
                .set('language', 'en-US')
                .set('region', 'IN')
                .set('sort_by', 'popularity.desc')
                .set('with_origin_country', 'IN') // Crucial for Indian content
                .set('page', page)
        }).pipe(catchError(this.handleError)));
    }

    getIndianTheatrical(page = 1): Observable<MovieSearchModel> {
        const key = `indian_theatrical_v2_${page}`;
        return this.getWithCache(key, this.http.get<MovieSearchModel>(`${this.BASE_URL}/movie/now_playing`, {
            params: new HttpParams()
                .set('language', 'en-US')
                .set('region', 'IN')
                .set('with_release_type', '3|2') // Theatrical
                .set('page', page)
        }).pipe(catchError(this.handleError)));
    }

    getDiscoverIndian(page = 1, languageISO: string = 'hi'): Observable<MovieSearchModel> {
        const key = `discover_indian_v2_${languageISO}_${page}`;
        let params = new HttpParams()
            .set('language', 'en-US')
            .set('region', 'IN')
            .set('sort_by', 'popularity.desc')
            .set('page', page);

        if (languageISO === 'all') {
            params = params.set('with_origin_country', 'IN');
        } else {
            params = params.set('with_original_language', languageISO);
            // Optionally filter by India region release too if needed, but language is usually enough
            // params = params.set('region', 'IN');
        }

        return this.getWithCache(key, this.http.get<MovieSearchModel>(`${this.BASE_URL}/discover/movie`, {
            params: params
        }).pipe(catchError(this.handleError)));
    }

    /** Get Upcoming Movies */
    getUpcomingMovies(page: number = 1): Observable<MovieUpcomingModel> {
        const key = `upcoming_movies_${page}`;
        const today = new Date();
        const minDate = today.toISOString().split('T')[0];
        const maxDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate()).toISOString().split('T')[0];

        const dynamicParams = {
            "release_date.gte": minDate,
            "release_date.lte": maxDate,
            "with_release_type": '2|3',
            "with_origin_country": 'IN',
            "with_original_language": 'hi',
            "language": 'en-US',
            "page": page.toString()
        };

        const upcomingUrl = buildDiscoverMovieUrl(this.BASE_URL, dynamicParams);

        return this.getWithCache(key, this.http.get<MovieUpcomingModel>(upcomingUrl)
            .pipe(catchError(this.handleError)));
    }

    /** Movie Details */
    getMovieDetail(movieId: number): Observable<MovieDetailModel> {
        const key = `movie_detail_${movieId}`;
        const params = new HttpParams()
            .set('append_to_response', 'videos,recommendations,similar')
            .set('language', 'en-US');

        // Cache details for 24 hours (86400000 ms)
        return this.getWithCache(key, this.http.get<MovieDetailModel>(`${this.BASE_URL}/movie/${movieId}`, { params })
            .pipe(catchError(this.handleError)), 86400000);
    }

    getTvDetail(tvId: number): Observable<TvDetailModel> {
        const key = `tv_detail_${tvId}`;
        const params = new HttpParams()
            .set('append_to_response', 'videos,recommendations,similar')
            .set('language', 'en-US');

        // Cache details for 24 hours
        return this.getWithCache(key, this.http.get<TvDetailModel>(`${this.BASE_URL}/tv/${tvId}`, { params })
            .pipe(catchError(this.handleError)), 86400000);
    }

    getPopularPersons(page = 1): Observable<PersonModel> {
        const key = `trending_persons_${page}`; // Updated key
        return this.getWithCache(key, this.http.get<PersonModel>(`${this.BASE_URL}/trending/person/day`, {
            params: new HttpParams()
                .set('language', 'en-US')
                .set('page', page)
        }).pipe(catchError(this.handleError)));
    }

    getPersonDetail(id: number): Observable<PersonDetailModel> {
        const key = `person_detail_full_${id}`;
        // Cache for 24 hours
        return this.getWithCache(key, this.http.get<PersonDetailModel>(`${this.BASE_URL}/person/${id}`, {
            params: new HttpParams()
                .set('language', 'en-US')
                .set('append_to_response', 'images,external_ids,combined_credits')
        }).pipe(catchError(this.handleError)), 86400000);
    }

    getTopRatedMovies(page: number = 1): Observable<MovieTopRatedModel> {
        const key = `top_rated_movies_${page}`;
        return this.getWithCache(key, this.http.get<MovieTopRatedModel>(`${this.BASE_URL}/movie/top_rated`, {
            params: new HttpParams()
                .set('language', 'en-US')
                .set('page', page)
        }).pipe(catchError(this.handleError)));
    }

    getTopRatedTV(page: number = 1): Observable<TvTopRatedModelRoot> {
        const key = `top_rated_tv_${page}`;
        return this.getWithCache(key, this.http.get<TvTopRatedModelRoot>(`${this.BASE_URL}/tv/top_rated`, {
            params: new HttpParams()
                .set('language', 'en-US')
                .set('page', page)
        }).pipe(catchError(this.handleError)));
    }

    getDiscoverMovies(params: any): Observable<MovieSearchModel> {
        // Generate a unique cache key based on params
        const key = `discover_movie_${JSON.stringify(params)}`;

        // Build URL
        const url = buildDiscoverMovieUrl(this.BASE_URL, params);

        // Execute with Cache
        return this.getWithCache(key, this.http.get<MovieSearchModel>(url).pipe(
            catchError(this.handleError)
        ));
    }
}