export interface TmdbReleaseDateItemDto {
    /**
     * The age certification for this release (e.g., 'R', 'PG-13', '18', '16').
     */
    certification: string;
    /**
     * Optional descriptors for the rating (e.g., ['Violence', 'Language']).
     */
    descriptors: string[];
    /**
     * The ISO-639-1 language code associated with this release.
     */
    iso_639_1: string;
    /**
     * Additional notes about the release (e.g., 'Premiere', 'Blu-ray', 'Netflix').
     */
    note: string;
    /**
     * The exact date and time of the release (Format: ISO-8601).
     */
    release_date: string;
    /**
     * The release type. 
     * 1: Premiere, 2: Theatrical (limited), 3: Theatrical, 4: Digital, 5: Physical, 6: TV.
     */
    type: number;
}

export interface TmdbReleaseDateGroupDto {
    /**
     * The ISO-3166-1 country code for this group of release dates (e.g., 'US', 'DE', 'FR').
     */
    iso_3166_1: string;
    /**
     * The list of specific release dates and formats in this country.
     */
    release_dates: TmdbReleaseDateItemDto[];
}

export interface TmdbMovieReleaseDatesResponseDto {
    /**
     * The TMDB Movie ID.
     */
    id: number;
    /**
     * An array of release dates grouped by country.
     */
    results: TmdbReleaseDateGroupDto[];
}