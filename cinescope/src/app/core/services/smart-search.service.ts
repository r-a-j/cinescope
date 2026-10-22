import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SemanticIntentParameters {
    person_name?: string;
    genres?: number[];
    keywords?: string[];
    sort_by?: 'popularity.desc' | 'primary_release_date.desc' | 'primary_release_date.asc' | 'vote_average.desc';
    query?: string;
}

export interface SemanticIntentSection {
    title: string;
    action: 'discover_movies' | 'discover_tv' | 'exact_match';
    parameters: SemanticIntentParameters;
}

export interface SmartSearchResponseDto {
    sections: SemanticIntentSection[];
    degraded?: boolean;
    notice?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SmartSearchService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/smart-search`;
    private readonly clientCache = new Map<string, SmartSearchResponseDto>();

    /**
     * Hits the Node.js Vercel proxy to invoke Gemini for semantic search translation.
     * Caches results client-side so duplicate queries in the session return instantaneously.
     * @param query The raw user string (e.g. "movies about space travel")
     * @returns An array of SemanticIntentSection objects deduced by the AI.
     */
    getSmartSuggestions(query: string): Observable<SmartSearchResponseDto> {
        const normalizedKey = query.trim().toLowerCase();
        const cached = this.clientCache.get(normalizedKey);
        if (cached) {
            return of(cached);
        }

        return this.http.post<SmartSearchResponseDto>(this.apiUrl, {
            query,
            models: environment.geminiModels
        }).pipe(
            tap(response => {
                if (response && response.sections && response.sections.length > 0) {
                    this.clientCache.set(normalizedKey, response);
                }
            })
        );
    }
}
