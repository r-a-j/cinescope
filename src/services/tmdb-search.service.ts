import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SettingModel } from '../models/setting.model';
import { MovieSearchModel } from 'src/models/movie/movie-search.model';
import { TvSearchModel } from 'src/models/tv/tv-search.model';


@Injectable({ providedIn: 'root' })
export class TmdbSearchService {
    private BASE_URL = 'https://api.themoviedb.org/3';
    private settings: SettingModel = {
        tmdbApiKey: '',
        allowAdultContent: false
    };

    // Base URL and query parameters for Bollywood movies in Hindi
    private apiUrl = 'https://api.themoviedb.org/3/discover/movie';
    private apiParams =
        '?include_adult=false&include_video=true&language=en-US&primary_release_year=2025&sort_by=vote_average.desc&with_origin_country=IN&with_original_language=hi';

    private options = {
        headers: {
            accept: 'application/json',
            Authorization: ''
        }
    };

    constructor(private http: HttpClient) {
        // Load from localStorage or storage service if needed
        const stored = localStorage.getItem('tmdbSettings');
        if (stored) {
            this.settings = JSON.parse(stored);
        }
    }

    private get headers() {
        return new HttpHeaders({
            accept: 'application/json',
            Authorization: `Bearer ${this.settings.tmdbApiKey}`
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
}
