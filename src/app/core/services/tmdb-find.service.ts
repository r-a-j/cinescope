import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TmdbFindResultsDto } from '../dtos/find/find-results.dto';
import { TmdbExternalSource } from '../dtos/find/external-source.type';
import { BaseMediaService } from './base-media.service';

@Injectable({ providedIn: 'root' })
export class TmdbFindService extends BaseMediaService {
    // This is an excellent endpoint to tackle.The Find By ID endpoint is deceptively powerful.As you noted from
    // the TMDB documentation, it acts as a universal Rosetta Stone, translating external IDs(like IMDb, TVDB, 
    // or even Instagram handles) directly into TMDB objects.

    // For CINESCOPE, this is the exact endpoint you will use to build the "1-Click Migration"(Scenario 54) 
    // feature.When a user uploads their Letterboxd CSV export (which relies heavily on IMDb tt IDs), you will 
    // loop through this endpoint using external_source = imdb_id to seamlessly import their entire history in seconds.

    /**
     * Find data by external ID's.
     * This method searches all objects (movies, TV shows and people) 
     * and returns the results in a single response.
     * * @param externalId The external identifier (e.g., 'tt0111161' for The Shawshank Redemption).
     * @param externalSource The platform the ID belongs to (e.g., 'imdb_id').
     * @param language Optional ISO 639-1 language code (defaults to en-US).
     * Beyond importing watchlists from competitors, this endpoint is also brilliant for social sharing. 
     * If a user drops a link to a TikTok video of an actor's fan-edit into your app, you can pass the TikTok 
     * username/ID (tiktok_id) into this endpoint, and TMDB will return the exact person_results DTO. Your app 
     * can then instantly navigate to that actor's filmography.
     */
    findByExternalId(
        externalId: string,
        externalSource: TmdbExternalSource,
        language = 'en-US'
    ): Observable<TmdbFindResultsDto> {
        const params = this.buildParams({
            external_source: externalSource,
            language: language
        });

        return this.http.get<TmdbFindResultsDto>(`${this.apiPrefix}/find/${externalId}`, { params });
    }
}