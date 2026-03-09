export interface TmdbTvTranslationDataDto {
    /** The translated title of the TV show. */
    name: string;
    /** The translated synopsis of the TV show. */
    overview: string;
    /** The localized homepage URL (if a specific region has its own site). */
    homepage: string;
    /** The translated tagline/slogan of the TV show. */
    tagline: string;
}

export interface TmdbTvTranslationItemDto {
    /** The ISO-3166-1 country code (e.g., 'US', 'SA'). */
    iso_3166_1: string;
    /** The ISO-639-1 language code (e.g., 'en', 'ar'). */
    iso_639_1: string;
    /** The localized name of the language. */
    name: string;
    /** The English name of the language (e.g., 'Arabic'). */
    english_name: string;
    /** The actual translated text payloads. */
    data: TmdbTvTranslationDataDto;
}

export interface TmdbTvTranslationsResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The array of available translations for this TV show. */
    translations: TmdbTvTranslationItemDto[];
}