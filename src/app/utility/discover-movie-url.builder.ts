/**
 * Builds the dynamic URL for the TMDB discover/movie endpoint.
 *
 * @param baseUrl - The base URL for the API (e.g. this.BASE_URL).
 * @param params - An object containing any query parameters. Supported keys include:
 *   certification, certification.gte, certification.lte, certification_country,
 *   include_adult, include_video, language, page, primary_release_year,
 *   primary_release_date.gte, primary_release_date.lte, region,
 *   release_date.gte, release_date.lte, sort_by, vote_average.gte, vote_average.lte,
 *   vote_count.gte, vote_count.lte, watch_region, with_cast, with_companies,
 *   with_crew, with_genres, with_keywords, with_origin_country, with_original_language,
 *   with_people, with_release_type, with_runtime.gte, with_runtime.lte,
 *   with_watch_monetization_types, with_watch_providers, without_companies,
 *   without_genres, without_keywords, without_watch_providers, year.
 *
 * @returns The full URL string with encoded query parameters.
 */
export function buildDiscoverMovieUrl(
    baseUrl: string,
    params: Record<string, any>
): string {
    // Default parameters
    const defaults: Record<string, any> = {
        include_adult: false,
        include_video: false,
        language: 'en-US',
        page: 1,
        sort_by: 'popularity.desc',
    };

    // Merge defaults with provided params. Provided values will override defaults.
    const mergedParams = { ...defaults, ...params };

    // Construct query parameters string (skip keys with undefined or null values)
    const queryString = Object.entries(mergedParams)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(
            ([key, value]) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join('&');

    return `${baseUrl}/discover/movie?${queryString}`;
}
