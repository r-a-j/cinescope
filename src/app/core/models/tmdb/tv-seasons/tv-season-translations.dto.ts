// tv-season-translations.dto.ts
export interface TmdbTvSeasonTranslationDataDto {
    /** The translated title of the season (e.g., 'Saison 1'). */
    name: string;
    /** The translated synopsis of the season. */
    overview: string;
}

export interface TmdbTvSeasonTranslationItemDto {
    iso_3166_1: string;
    iso_639_1: string;
    name: string;
    english_name: string;
    /** The translated text payload for the season. */
    data: TmdbTvSeasonTranslationDataDto;
}

export interface TmdbTvSeasonTranslationsResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** The array of available localized translations for this season. */
    translations: TmdbTvSeasonTranslationItemDto[];
}