export interface TmdbKeywordDto {
    /**
     * The TMDB internal ID for the keyword.
     */
    id: number;
    /**
     * The text value of the keyword (e.g., "hero", "cyberpunk").
     */
    name: string;
}