export interface TmdbDiscoverTvParamsDto {
    'air_date.gte'?: string; // Format: YYYY-MM-DD
    'air_date.lte'?: string; // Format: YYYY-MM-DD
    first_air_date_year?: number;
    'first_air_date.gte'?: string; // Format: YYYY-MM-DD
    'first_air_date.lte'?: string; // Format: YYYY-MM-DD
    include_adult?: boolean;
    include_null_first_air_dates?: boolean;
    language?: string;
    page?: number;
    screened_theatrically?: boolean;
    sort_by?:
    | 'first_air_date.asc' | 'first_air_date.desc'
    | 'name.asc' | 'name.desc'
    | 'original_name.asc' | 'original_name.desc'
    | 'popularity.asc' | 'popularity.desc'
    | 'vote_average.asc' | 'vote_average.desc'
    | 'vote_count.asc' | 'vote_count.desc';
    timezone?: string;
    'vote_average.gte'?: number;
    'vote_average.lte'?: number;
    'vote_count.gte'?: number;
    'vote_count.lte'?: number;
    watch_region?: string;
    with_companies?: string; // Comma (AND) or Pipe (OR) separated
    with_genres?: string; // Comma (AND) or Pipe (OR) separated
    with_keywords?: string; // Comma (AND) or Pipe (OR) separated
    with_networks?: number;
    with_origin_country?: string;
    with_original_language?: string;
    'with_runtime.gte'?: number;
    'with_runtime.lte'?: number;
    /**
     * Possible values: 0 (Returning Series), 1 (Planned), 2 (In Production), 3 (Ended), 4 (Canceled), 5 (Pilot)
     */
    with_status?: string;
    with_watch_monetization_types?: 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';
    with_watch_providers?: string; // Comma (AND) or Pipe (OR) separated
    without_companies?: string;
    without_genres?: string;
    without_keywords?: string;
    without_watch_providers?: string;
    /**
     * Possible values: 0 (Documentary), 1 (News), 2 (Miniseries), 3 (Reality), 4 (Scripted), 5 (Talk Show), 6 (Video)
     */
    with_type?: string;
}