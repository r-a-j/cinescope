export interface TmdbCountryDto {
    /**
     * The ISO 3166-1 alpha-2 country code (e.g., 'US', 'IN', 'DE').
     */
    iso_3166_1: string;
    /**
     * The English name of the country.
     */
    english_name: string;
    /**
     * The native name of the country in its local language.
     */
    native_name: string;
}