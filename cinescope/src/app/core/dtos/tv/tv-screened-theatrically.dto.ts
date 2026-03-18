export interface TmdbTvScreenedTheatricallyItemDto {
    /** The unique TMDB ID for this specific theatrical screening record. */
    id: number;
    /** The specific episode number that was screened. */
    episode_number: number;
    /** The season number that the screened episode belongs to. */
    season_number: number;
}

export interface TmdbTvScreenedTheatricallyResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The list of episodes that received a theatrical release. */
    results: TmdbTvScreenedTheatricallyItemDto[];
}