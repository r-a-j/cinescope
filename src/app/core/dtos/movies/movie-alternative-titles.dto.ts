export interface TmdbMovieAlternativeTitleDto {
    /**
     * The ISO 3166-1 alpha-2 country code (e.g., 'US', 'MX', 'DE').
     */
    iso_3166_1: string;
    /**
     * The localized or alternative title.
     */
    title: string;
    /**
     * The type of alternative title (e.g., 'romanization', 'Hispanoamérica', or just an empty string).
     */
    type: string;
}

export interface TmdbMovieAlternativeTitlesResponseDto {
    /**
     * The TMDB Movie ID.
     */
    id: number;
    /**
     * The list of alternative titles for the specified movie.
     */
    titles: TmdbMovieAlternativeTitleDto[];
}