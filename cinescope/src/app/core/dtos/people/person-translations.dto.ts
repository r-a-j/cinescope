export interface TmdbPersonTranslationDataDto {
    /**
     * The localized biography of the person.
     */
    biography: string;
    /**
     * The localized name of the person (useful for non-Latin alphabets like "Том Хэнкс" or "汤姆·汉克斯").
     */
    name: string;
}

export interface TmdbPersonTranslationItemDto {
    /**
     * The ISO-3166-1 country code (e.g., 'US', 'RU', 'CN').
     */
    iso_3166_1: string;
    /**
     * The ISO-639-1 language code (e.g., 'en', 'ru', 'zh').
     */
    iso_639_1: string;
    /**
     * The localized name of the language (e.g., 'Pусский', '普通话').
     */
    name: string;
    /**
     * The English name of the language (e.g., 'Russian', 'Mandarin').
     */
    english_name: string;
    /**
     * The actual translated data for the person.
     */
    data: TmdbPersonTranslationDataDto;
}

export interface TmdbPersonTranslationsResponseDto {
    /**
     * The TMDB Person ID.
     */
    id: number;
    /**
     * The list of available translations for this person.
     */
    translations: TmdbPersonTranslationItemDto[];
}