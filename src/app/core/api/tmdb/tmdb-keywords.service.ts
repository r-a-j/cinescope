import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbKeywordDto } from '../../models/tmdb/keywords/keyword.dto';

@Injectable({ providedIn: 'root' })
export class TmdbKeywordsService {
    constructor(private http: HttpClient) { }

    /**
     * Get keyword details by ID.
     * @param keywordId The TMDB Keyword ID.
     */
    getKeywordDetails(keywordId: number): Observable<TmdbKeywordDto> {
        return this.http.get<TmdbKeywordDto>(`/keyword/${keywordId}`);
    }

    // Pro-Tip for CINESCOPE
    // Keywords are the secret sauce for Scenario 14: The "Obsessive Rabbit Hole".

    // When a user logs a movie like Dune, you can fetch that movie's keywords (e.g., "sandworm", 
    // "prophecy", "desert planet"). You can then display these as clickable pill-tags. If the user 
    // taps the "desert planet" keyword, you grab its keyword_id and pass it directly into the 
    // discoverMovies({ with_keywords: '1234' }) method we built earlier to instantly generate a 
    // hyper-niche recommendation list!
}