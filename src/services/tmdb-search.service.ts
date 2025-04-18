import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SettingModel } from '../models/setting.model';
import { MovieSearchModel } from 'src/models/movie/movie-search.model';
import { TvSearchModel } from 'src/models/tv/tv-search.model';
import { MovieUpcomingModel } from 'src/models/movie/movie-upcoming.model';
import { buildDiscoverMovieUrl } from 'src/app/utility/discover-movie-url.builder';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';
import { StorageService } from './storage.service';


@Injectable({ providedIn: 'root' })
export class TmdbSearchService {

    private TMDB_API_KEY = '';
    private ALLOWED_ADULT_CONTENT = false;

    private BASE_URL = 'https://api.themoviedb.org/3';
    private settings: SettingModel = {
        tmdbApiKey: this.TMDB_API_KEY,
        allowAdultContent: this.ALLOWED_ADULT_CONTENT
    };

    // Base URL and query parameters for Bollywood movies in Hindi
    private apiUrl = 'https://api.themoviedb.org/3/discover/movie';
    private apiParams =
        '?include_adult=' + 
        String(this.ALLOWED_ADULT_CONTENT) + 
        '&include_video=true&language=en-US&primary_release_year=2025&sort_by=vote_average.desc&with_origin_country=IN&with_original_language=hi';

    private options = {
        headers: {
            accept: 'application/json',
            Authorization: 'Bearer ' + this.TMDB_API_KEY
        }
    };

    constructor(
        private http: HttpClient,
        private storageService: StorageService
    ) {
        this.storageService.getSettings().then((settings: SettingModel | null) => {
            if (settings) {
              this.TMDB_API_KEY = settings.tmdbApiKey || '';
              this.ALLOWED_ADULT_CONTENT = settings.allowAdultContent || false;
            }
          });
    }

    private get headers() {
        return new HttpHeaders({
            accept: 'application/json',
            Authorization: `Bearer ${this.TMDB_API_KEY}`
        });
    }

    updateSettings(settings: SettingModel) {
        this.settings = settings;
        localStorage.setItem('tmdbSettings', JSON.stringify(settings));
    }

    searchMovies(query: string, page = 1, year?: string, lang?: string): Observable<MovieSearchModel> {
        let params = new HttpParams()
            .set('query', query)
            .set('include_adult', this.settings.allowAdultContent.toString())
            .set('language', 'en-US')
            .set('page', page);

        if (year) params = params.set('year', year);
        if (lang) params = params.set('language', lang);

        return this.http.get<MovieSearchModel>(`${this.BASE_URL}/search/movie`, {
            headers: this.headers,
            params
        }).pipe(catchError(this.handleError));
    }

    searchTV(query: string, page = 1, year?: string, lang?: string): Observable<TvSearchModel> {
        let params = new HttpParams()
            .set('query', query)
            .set('include_adult', this.settings.allowAdultContent.toString())
            .set('language', 'en-US')
            .set('page', page);

        if (year) params = params.set('year', year);
        if (lang) params = params.set('language', lang);

        return this.http.get<TvSearchModel>(`${this.BASE_URL}/search/tv`, {
            headers: this.headers,
            params
        }).pipe(catchError(this.handleError));
    }

    getTrendingBollywoodMovies(page: number = 1): Observable<MovieSearchModel> {
        const url = `${this.apiUrl}${this.apiParams}&page=${page}`;
        return this.http.get<MovieSearchModel>(url, this.options);
    }

    private handleError(error: any) {
        console.error('TMDB API Error:', error);
        return throwError(() => new Error('Something went wrong with the TMDB API.'));
    }

    getUpcomingMovies(page: number = 1): Observable<MovieUpcomingModel> {
        // Compute dynamic date parameters:
        const today = new Date();
        const minDate = today.toISOString().split('T')[0];
        const maxDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate()).toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();

        console.log(minDate);
        console.log(maxDate);
        console.log(currentYear);

        // const url = `${this.BASE_URL}/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}&with_release_type=2|3&release_date.gte=${minDate}&release_date.lte=${maxDate}&with_origin_country=IN&with_original_language=hi`;
        const dynamicParams = {
            "release_date.gte": minDate,
            "release_date.lte": maxDate,
            "with_release_type": '2|3',
            "with_origin_country": 'IN',
            "with_original_language": 'hi',
        };

        const upcomingurl = buildDiscoverMovieUrl(this.BASE_URL, dynamicParams);
        console.log(upcomingurl);
        return this.http.get<MovieUpcomingModel>(upcomingurl, this.options);
    }

    getMovieDetail(movieId: number): Observable<MovieDetailModel> {
        const params = new HttpParams()
            .set('append_to_response', 'videos,recommendations,similar')
            .set('language', 'en-US');

        return this.http.get<MovieDetailModel>(`${this.BASE_URL}/movie/${movieId}`, {
            headers: this.headers,
            params
        }).pipe(
            catchError(this.handleError)
        );
    }
}
