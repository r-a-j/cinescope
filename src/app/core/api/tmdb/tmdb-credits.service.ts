import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbCreditDetailDto } from '../../models/tmdb/credits/credit-detail.dto';

@Injectable({ providedIn: 'root' })
export class TmdbCreditsService {
    constructor(private http: HttpClient) { }

    /**
     * Get a movie or TV credit details by ID.
     * @param creditId The TMDB Credit ID (string hash).
     * This specific endpoint is perfect for the "Behind the Scenes Nostalgia" or "The Character Actor Tracker" 
     * scenarios you mentioned earlier. If a user clicks on an obscure actor's role, you can use this credit_id 
     * to fetch the exact TV season they appeared in, allowing you to highlight exactly which episodes the user 
     * needs to watch to see them!
     */
    getCreditDetails(creditId: string): Observable<TmdbCreditDetailDto> {
        return this.http.get<TmdbCreditDetailDto>(`/credit/${creditId}`);
    }
}