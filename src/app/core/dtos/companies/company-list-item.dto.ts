export interface TmdbCompanyListItemDto {
    /**
     * The unique TMDB ID for the company (e.g., 3268 for "HBO").
     */
    id: number;
    /**
     * The path to the company's logo image.
     */
    logo_path: string | null;
    /**
     * The name of the company (e.g., "HBO").
     */
    name: string;
    /**
     * The ISO-3166-1 origin country code for the company (e.g., "US").
     */
    origin_country: string;
}