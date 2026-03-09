export interface TmdbWatchProviderDto {
    /**
     * The path to the provider's logo image.
     */
    logo_path: string;
    /**
     * The unique TMDB ID for the provider (e.g., 8 for Netflix, 119 for Amazon Prime).
     */
    provider_id: number;
    /**
     * The name of the provider (e.g., "Netflix", "Apple TV").
     */
    provider_name: string;
    /**
     * The priority for displaying this provider in the UI. Lower numbers mean higher priority.
     */
    display_priority: number;
}

export interface TmdbWatchProviderRegionDto {
    /**
     * The TMDB/JustWatch URL for this specific region. 
     * Note: You must attribute JustWatch if you use this data!
     */
    link: string;
    /**
     * Subscription streaming services (e.g., Netflix, Hulu).
     */
    flatrate?: TmdbWatchProviderDto[];
    /**
     * Services where you can rent the movie.
     */
    rent?: TmdbWatchProviderDto[];
    /**
     * Services where you can purchase the movie digitally.
     */
    buy?: TmdbWatchProviderDto[];
    /**
     * Ad-supported streaming services (e.g., Pluto TV, Freevee).
     */
    ads?: TmdbWatchProviderDto[];
    /**
     * Completely free streaming options.
     */
    free?: TmdbWatchProviderDto[];
}

/**
 * Represents a valid country/region that TMDB has JustWatch streaming data for.
 */
export interface TmdbWatchRegionDto {
    /** The ISO-3166-1 country code (e.g., 'US', 'DE') */
    iso_3166_1: string;
    /** The English name of the country */
    english_name: string;
    /** The localized, native name of the country */
    native_name: string;
}

export interface TmdbWatchRegionsResponseDto {
    results: TmdbWatchRegionDto[];
}

/**
 * Represents a streaming provider from the global list, extending the base DTO 
 * to include the country-specific priority rankings.
 */
export interface TmdbGlobalWatchProviderDto extends TmdbWatchProviderDto {
    /** * A dictionary mapping ISO-3166-1 country codes to their specific display priority rank.
     * Lower numbers mean the provider is more popular/important in that specific country.
     */
    display_priorities: Record<string, number>;
}

export interface TmdbGlobalWatchProvidersResponseDto {
    results: TmdbGlobalWatchProviderDto[];
}