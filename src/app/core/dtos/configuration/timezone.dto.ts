export interface TmdbTimezoneDto {
    /**
     * The ISO 3166-1 alpha-2 country code (e.g., 'US', 'IN').
     */
    iso_3166_1: string;
    /**
     * A list of valid timezone strings for that country (e.g., 'America/New_York').
     */
    zones: string[];
}