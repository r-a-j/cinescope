import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
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
}

@Injectable({
    providedIn: 'root'
})
export class SmartSearchService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/smart-search`;

    /**
     * Hits the Node.js Vercel proxy to invoke Gemini 2.5 Flash for semantic search translation.
     * @param query The raw user string (e.g. "movies about space travel")
     * @returns An array of SmartSearchEntity objects deduced by the AI.
     */
    getSmartSuggestions(query: string): Observable<SmartSearchResponseDto> {
        // Enforce the strict security handshake header outlined in `extract.ts`
        const headers = new HttpHeaders({
            'x-cinescope-client': 'CS-Mobile-App-2026'
        });

        // Hitting the Vercel function (or local dev proxy)
        // Passes the user query and the array of available fallback SDK models
        return this.http.post<SmartSearchResponseDto>(this.apiUrl, { 
            query,
            models: environment.geminiModels 
        }, { headers });
    }
}
