import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// Assuming you moved these to a 'collections' folder for consistency
import { TmdbCollectionDetailDto } from '../../models/tmdb/collections/collection-detail.dto';
import { TmdbCollectionImagesDto } from '../../models/tmdb/collections/collection-images.dto';
import { TmdbCollectionTranslationsDto } from '../../models/tmdb/collections/collection-translations.dto';

@Injectable({ providedIn: 'root' })
export class TmdbCollectionsService {
    constructor(private http: HttpClient) { }

    /**
     * Get collection details by ID.
     * @param collectionId The TMDB Collection ID.
     * @param language Optional ISO 639-1 language code (defaults to en-US).
     */
    getCollectionDetails(collectionId: number, language: string = 'en-US'): Observable<TmdbCollectionDetailDto> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbCollectionDetailDto>(`/collection/${collectionId}`, { params });
    }

    /**
     * Get the images that belong to a collection.
     * @param collectionId The TMDB Collection ID.
     * @param language Optional ISO 639-1 language code.
     * @param includeImageLanguage Comma separated ISO-639-1 values (e.g. 'en,null').
     */
    getCollectionImages(
        collectionId: number,
        language?: string,
        includeImageLanguage?: string
    ): Observable<TmdbCollectionImagesDto> {
        let params = new HttpParams();
        if (language) params = params.set('language', language);
        if (includeImageLanguage) params = params.set('include_image_language', includeImageLanguage);

        return this.http.get<TmdbCollectionImagesDto>(`/collection/${collectionId}/images`, { params });
    }

    /**
     * Get the translations that belong to a collection.
     * @param collectionId The TMDB Collection ID.
     */
    getCollectionTranslations(collectionId: number): Observable<TmdbCollectionTranslationsDto> {
        return this.http.get<TmdbCollectionTranslationsDto>(`/collection/${collectionId}/translations`);
    }
}