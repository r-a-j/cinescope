export interface TmdbTranslationDataDto {
    title?: string;
    name?: string; // TV Shows/People often use name instead of title
    overview?: string;
    biography?: string; // People use biography
    homepage?: string;
}

export interface TmdbTranslationItemDto<T = TmdbTranslationDataDto> {
    iso_3166_1: string;
    iso_639_1: string;
    name: string;
    english_name: string;
    data: T;
}