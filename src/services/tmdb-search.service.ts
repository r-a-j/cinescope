import { Injectable, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { from, Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { SettingModel } from '../models/setting.model';
import { MovieSearchModel } from 'src/models/movie/movie-search.model';
import { TvSearchModel } from 'src/models/tv/tv-search.model';
import { MovieUpcomingModel } from 'src/models/movie/movie-upcoming.model';
import { buildDiscoverMovieUrl } from 'src/app/utility/discover-movie-url.builder';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';
import { StorageService } from './storage.service';
import { PersonModel } from 'src/models/person.model';
import { MovieTopRatedModel } from 'src/models/movie/movie-top-rated.model';
import { TvTopRatedModelRoot } from 'src/models/tv/tv-top-rated.model';
import { TvDetailModel } from 'src/models/tv/tv-detail.model';


@Injectable({ providedIn: 'root' })
export class TmdbSearchService {
    private settings: SettingModel = {
        tmdbApiKey: '',
        allowAdultContent: false
    };

    private BASE_URL = 'https://api.themoviedb.org/3';
    private settingsLoaded = false;

    constructor(
        private http: HttpClient,
        private storageService: StorageService
    ) {
        this.loadSettings();
    }

    /** Load settings once during service construction */
    private async loadSettings() {
        const settings = await this.storageService.getSettings();
        if (settings) {
            this.settings = settings;
            this.settingsLoaded = true;
        } else {
            console.warn('TMDB settings not found, using defaults.');
        }
    }

    /** Safe dynamic headers */
    private get headers() {
        return new HttpHeaders({
            accept: 'application/json',
            Authorization: `Bearer ${this.settings.tmdbApiKey}`
        });
    }

    /** Wait for settings if needed */
    private async ensureSettingsLoaded(): Promise<void> {
        const settings = await this.storageService.getSettings();
        if (settings) {
            this.settings = settings;
            this.settingsLoaded = true;
        }
    }

    /** Handle API errors */
    private handleError(error: any) {
        console.error('TMDB API Error:', error);
        return throwError(() => new Error('Something went wrong with the TMDB API.'));
    }

    /** Search Movies */
    searchMovies(query: string, page = 1, year?: string, lang: string = 'en-US'): Observable<MovieSearchModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
                let params = new HttpParams()
                    .set('query', query)
                    .set('include_adult', this.settings.allowAdultContent.toString())
                    .set('language', lang)
                    .set('page', page);

                if (year) params = params.set('year', year);

                return this.http.get<MovieSearchModel>(`${this.BASE_URL}/search/movie`, {
                    headers: this.headers,
                    params
                });
            }),
            catchError(this.handleError)
        );
    }

    /** Search TV Shows */
    searchTV(query: string, page = 1, year?: string, lang: string = 'en-US'): Observable<TvSearchModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
                let params = new HttpParams()
                    .set('query', query)
                    .set('include_adult', this.settings.allowAdultContent.toString())
                    .set('language', lang)
                    .set('page', page);

                if (year) params = params.set('first_air_date_year', year);

                return this.http.get<TvSearchModel>(`${this.BASE_URL}/search/tv`, {
                    headers: this.headers,
                    params
                });
            }),
            catchError(this.handleError)
        );
    }

    /** Trending Bollywood Movies */
    getTrendingBollywoodMovies(page: number = 1): Observable<MovieSearchModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
                const discoveryUrl = `${this.BASE_URL}/discover/movie`;
                const apiParams = new HttpParams()
                    .set('include_adult', this.settings.allowAdultContent.toString())
                    .set('include_video', 'true')
                    .set('language', 'en-US')
                    .set('primary_release_year', '2025')
                    .set('sort_by', 'vote_average.desc')
                    .set('with_origin_country', 'IN')
                    .set('with_original_language', 'hi')
                    .set('page', page);

                return this.http.get<MovieSearchModel>(discoveryUrl, {
                    headers: this.headers,
                    params: apiParams
                });
            }),
            catchError(this.handleError)
        );
    }

    /** Get Upcoming Movies */
    getUpcomingMovies(page: number = 1): Observable<MovieUpcomingModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
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

                return this.http.get<MovieUpcomingModel>(upcomingUrl, {
                    headers: this.headers
                });
            }),
            catchError(this.handleError)
        );
    }

    /** Movie Details */
    getMovieDetail(movieId: number): Observable<MovieDetailModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
                const params = new HttpParams()
                    .set('append_to_response', 'videos,recommendations,similar')
                    .set('language', 'en-US');

                return this.http.get<MovieDetailModel>(`${this.BASE_URL}/movie/${movieId}`, {
                    headers: this.headers,
                    params
                });
            }),
            catchError(this.handleError)
        );
    }

    getTvDetail(tvId: number): Observable<TvDetailModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
                const params = new HttpParams()
                    .set('append_to_response', 'videos,recommendations,similar')
                    .set('language', 'en-US');

                return this.http.get<TvDetailModel>(`${this.BASE_URL}/tv/${tvId}`, {
                    headers: this.headers,
                    params
                });
            }),
            catchError(this.handleError)
        );
    }

    getPopularPersons(page = 1): Observable<PersonModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() =>
                this.http.get<PersonModel>(`${this.BASE_URL}/person/popular`, {
                    headers: this.headers,
                    params: new HttpParams()
                        .set('language', 'en-US')
                        .set('page', page)
                })
            ),
            catchError(this.handleError)
        );
    }

    getTopRatedMovies(page: number = 1): Observable<MovieTopRatedModel> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
                return this.http.get<MovieTopRatedModel>(`${this.BASE_URL}/movie/top_rated`, {
                    headers: this.headers,
                    params: new HttpParams()
                        .set('language', 'en-US')
                        .set('page', page)
                });
            }),
            catchError(this.handleError)
        );
    }

    getTopRatedTV(page: number = 1): Observable<TvTopRatedModelRoot> {
        return from(this.ensureSettingsLoaded()).pipe(
            switchMap(() => {
                return this.http.get<TvTopRatedModelRoot>(`${this.BASE_URL}/tv/top_rated`, {
                    headers: this.headers,
                    params: new HttpParams()
                        .set('language', 'en-US')
                        .set('page', page)
                });
            }),
            catchError(this.handleError)
        );
    }
}