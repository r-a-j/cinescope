export interface TmdbCollectionListItemDto {
    /**
     * Indicates if the collection contains adult content.
     */
    adult: boolean;
    /**
     * The path to the background image for the collection.
     */
    backdrop_path: string | null;
    /**
     * The unique TMDB ID for the collection (e.g., 86311 for "The Avengers Collection").
     */
    id: number;
    /**
     * The localized name of the collection.
     */
    name: string;
    /**
     * The ISO 639-1 code of the original language.
     */
    original_language: string;
    /**
     * The original, untranslated name of the collection.
     */
    original_name: string;
    /**
     * A brief overview or description of the franchise.
     */
    overview: string;
    /**
     * The path to the poster image for the collection.
     */
    poster_path: string | null;
}