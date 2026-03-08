export interface TmdbWatchProviderDto {
    /** The path to the streaming service's logo (e.g., '/9A1JSVmSxsyaodA3zrlXjj9Ijc9.jpg' for Netflix). */
    logo_path: string;
    /** The unique TMDB ID for the streaming provider. */
    provider_id: number;
    /** The name of the provider (e.g., 'Netflix', 'Amazon Video'). */
    provider_name: string;
    /** The display priority ranking (lower numbers should be displayed first). */
    display_priority: number;
}

export interface TmdbWatchProviderCountryDto {
    /** The TMDB-hosted link providing more details about the viewing options for this country. */
    link: string;
    /** Providers where the show is available via a flat-rate subscription (e.g., Netflix, Hulu). */
    flatrate?: TmdbWatchProviderDto[];
    /** Providers where the show can be purchased per episode/season (e.g., Apple TV, Amazon). */
    buy?: TmdbWatchProviderDto[];
    /** Providers where the show can be rented (less common for TV, but possible). */
    rent?: TmdbWatchProviderDto[];
    /** Providers where the show is available for free (often with ads). */
    free?: TmdbWatchProviderDto[];
    /** Providers where the show is available on an ad-supported tier. */
    ads?: TmdbWatchProviderDto[];
}

export interface TmdbTvWatchProvidersResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** * A dictionary of availability data, keyed by ISO-3166-1 country codes (e.g., 'US', 'GB', 'DE'). 
     */
    results: {
        [countryCode: string]: TmdbWatchProviderCountryDto;
    };
}