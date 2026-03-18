// tv-episode-translations.dto.ts
export interface TmdbTvEpisodeTranslationDataDto {
    name: string;
    overview: string;
}

export interface TmdbTvEpisodeTranslationItemDto {
    iso_3166_1: string;
    iso_639_1: string;
    name: string;
    english_name: string;
    data: TmdbTvEpisodeTranslationDataDto;
}

export interface TmdbTvEpisodeTranslationsResponseDto {
    /** The TMDB Episode ID. */
    id: number;
    /** The array of available localized translations for this episode. */
    translations: TmdbTvEpisodeTranslationItemDto[];
}