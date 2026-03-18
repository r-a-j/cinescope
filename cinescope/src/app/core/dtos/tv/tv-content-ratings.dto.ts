export interface TmdbTvContentRatingDto {
    /** * An array of specific reasons for the rating (e.g., ['Violence', 'Language', 'Nudity']).
     * Note: This array might be empty depending on the region's reporting standards.
     */
    descriptors: string[];
    /** * The ISO-3166-1 country code for this specific rating (e.g., 'DE', 'US', 'GB'). 
     */
    iso_3166_1: string;
    /** * The actual string representation of the age rating (e.g., '16', 'TV-MA', 'R21'). 
     */
    rating: string;
}

export interface TmdbTvContentRatingsResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The list of content ratings across different countries. */
    results: TmdbTvContentRatingDto[];
}