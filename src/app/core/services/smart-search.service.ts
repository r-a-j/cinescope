import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SmartSearchResponseDto {
    titles: string[];
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
     * @returns An array of string titles deduced by the AI.
     */
    getSmartSuggestions(query: string): Observable<SmartSearchResponseDto> {
        // Enforce the strict security handshake header outlined in `extract.ts`
        const headers = new HttpHeaders({
            'x-cinescope-client': 'CS-Mobile-App-2026'
        });

        // Hitting the Vercel function (or local dev proxy)
        // If the workspace uses native Vercel CLI `vercel dev`, it usually starts on port 3000.
        return this.http.post<SmartSearchResponseDto>(this.apiUrl, { query }, { headers });
    }
}
