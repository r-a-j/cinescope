export interface TmdbMovieTranslationDataDto {
    /**
     * The translated homepage URL.
     */
    homepage: string;
    /**
     * The localized plot synopsis.
     */
    overview: string;
    /**
     * The runtime (sometimes regional cuts of films have different runtimes).
     */
    runtime: number;
    /**
     * The localized tagline (e.g., "Mischief. Mayhem. Soap." vs. "Caos, travesuras y jabón").
     */
    tagline: string;
    /**
     * The localized title of the movie.
     */
    title: string;
}

export interface TmdbMovieTranslationItemDto {
    /**
     * The ISO-3166-1 country code (e.g., 'US', 'MX', 'DE').
     */
    iso_3166_1: string;
    /**
     * The ISO-639-1 language code (e.g., 'en', 'es', 'de').
     */
    iso_639_1: string;
    /**
     * The localized name of the language (e.g., 'Español').
     */
    name: string;
    /**
     * The English name of the language (e.g., 'Spanish').
     */
    english_name: string;
    /**
     * The actual translated data.
     */
    data: TmdbMovieTranslationDataDto;
}

export interface TmdbMovieTranslationsResponseDto {
    /**
     * The TMDB Movie ID.
     */
    id: number;
    /**
     * The list of available translations for this movie.
     */
    translations: TmdbMovieTranslationItemDto[];
}