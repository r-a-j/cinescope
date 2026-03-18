export interface TmdbTvAlternativeTitleDto {
    /** The ISO-3166-1 country code for this localized title (e.g., 'AL', 'BR'). */
    iso_3166_1: string;
    /** The actual alternative or translated title of the TV show. */
    title: string;
    /** The type of alternative title (often left blank, but sometimes used for distinctions like 'Working Title'). */
    type: string;
}

export interface TmdbTvAlternativeTitlesResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The list of alternative titles for the TV show. */
    results: TmdbTvAlternativeTitleDto[];
}