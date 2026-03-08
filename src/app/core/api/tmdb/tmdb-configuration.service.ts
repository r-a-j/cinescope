import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbConfigurationDetailDto } from '../../models/tmdb/configuration/configuration-detail.dto';
import { TmdbCountryDto } from '../../models/tmdb/configuration/country.dto';
import { TmdbJobDepartmentDto } from '../../models/tmdb/configuration/job-department.dto';
import { TmdbLanguageDto } from '../../models/tmdb/configuration/language.dto';
import { TmdbTimezoneDto } from '../../models/tmdb/configuration/timezone.dto';

@Injectable({ providedIn: 'root' })
export class TmdbConfigurationService {
    constructor(private http: HttpClient) { }

    /**
     * Query the API configuration details.
     * Provides system-wide configuration information like image base URLs and valid sizes.     
     * Because configuration data almost never changes, this is a prime candidate for extremely aggressive caching.
     * When you wire this up to your StorageService or CacheService later, you can safely cache this response for weeks
     * or even months at a time, saving the user's mobile data and speeding up the app's startup time!
     */
    getConfigurationDetails(): Observable<TmdbConfigurationDetailDto> {
        return this.http.get<TmdbConfigurationDetailDto>('/configuration');
    }

    /**
     * Get the list of countries (ISO 3166-1 tags) used throughout TMDB.
     * @param language Optional ISO 639-1 language code to translate the 'english_name' (defaults to en-US).     
     * This country list will be extremely useful for the "Geo-Cinematic Map" and "Theatrical Releases" features 
     * you defined in the product roadmap. You can fetch this list once, cache it in StorageService, and use it to 
     * populate dropdowns or map regions in the UI so the user can easily filter movies by their origin_country.
     */
    getCountries(language: string = 'en-US'): Observable<TmdbCountryDto[]> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbCountryDto[]>('/configuration/countries', { params });
    }

    /**
     * Get the list of the jobs and departments used on TMDB.     
     * Jobs: The Jobs list is incredible for advanced filtering. If a user is a hardcore cinephile 
     * (like from your Phase 12 roadmap), you can use this to let them search specifically for movies 
     * edited by a certain person or featuring a specific cinematographer, rather than just actors and directors.
     */
    getJobs(): Observable<TmdbJobDepartmentDto[]> {
        return this.http.get<TmdbJobDepartmentDto[]>('/configuration/jobs');
    }

    /**
     * Get the list of languages (ISO 639-1 tags) used throughout TMDB.
     * Languages: The Languages endpoint perfectly supports the "Discover Indian" features you already 
     * have in tmdb-search.service.ts, allowing you to dynamically populate a UI dropdown with native 
     * scripts (e.g., showing "हिन्दी" instead of just "Hindi").
     */
    getLanguages(): Observable<TmdbLanguageDto[]> {
        return this.http.get<TmdbLanguageDto[]>('/configuration/languages');
    }

    /**
     * Get a list of the officially supported translations on TMDB.
     * Returns an array of IETF language tags (e.g., 'en-US', 'fr-FR').
     */
    getPrimaryTranslations(): Observable<string[]> {
        return this.http.get<string[]>('/configuration/primary_translations');
    }

    /**
     * Get the list of timezones used throughout TMDB.
     */
    getTimezones(): Observable<TmdbTimezoneDto[]> {
        return this.http.get<TmdbTimezoneDto[]>('/configuration/timezones');
    }
}