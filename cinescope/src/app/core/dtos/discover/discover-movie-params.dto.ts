export interface TmdbDiscoverMovieParamsDto {
    certification?: string;
    'certification.gte'?: string;
    'certification.lte'?: string;
    certification_country?: string;
    include_adult?: boolean;
    include_video?: boolean;
    language?: string;
    page?: number;
    primary_release_year?: number;
    'primary_release_date.gte'?: string; // Format: YYYY-MM-DD
    'primary_release_date.lte'?: string; // Format: YYYY-MM-DD
    region?: string;
    'release_date.gte'?: string; // Format: YYYY-MM-DD
    'release_date.lte'?: string; // Format: YYYY-MM-DD
    sort_by?:
    | 'original_title.asc' | 'original_title.desc'
    | 'popularity.asc' | 'popularity.desc'
    | 'revenue.asc' | 'revenue.desc'
    | 'primary_release_date.asc' | 'primary_release_date.desc'
    | 'title.asc' | 'title.desc'
    | 'vote_average.asc' | 'vote_average.desc'
    | 'vote_count.asc' | 'vote_count.desc';
    'vote_average.gte'?: number;
    'vote_average.lte'?: number;
    'vote_count.gte'?: number;
    'vote_count.lte'?: number;
    watch_region?: string;
    with_cast?: string; // Comma (AND) or Pipe (OR) separated
    with_companies?: string; // Comma (AND) or Pipe (OR) separated
    with_crew?: string; // Comma (AND) or Pipe (OR) separated
    with_genres?: string; // Comma (AND) or Pipe (OR) separated
    with_keywords?: string; // Comma (AND) or Pipe (OR) separated
    with_origin_country?: string;
    with_original_language?: string;
    with_people?: string; // Comma (AND) or Pipe (OR) separated
    with_release_type?: string; // e.g., '2|3'
    'with_runtime.gte'?: number;
    'with_runtime.lte'?: number;
    with_watch_monetization_types?: 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';
    with_watch_providers?: string; // Comma (AND) or Pipe (OR) separated
    without_companies?: string;
    without_genres?: string;
    without_keywords?: string;
    without_watch_providers?: string;
    year?: number;
}