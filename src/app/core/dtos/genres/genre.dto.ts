export interface TmdbGenreDto {
    /**
     * The TMDB internal ID for the genre (e.g., 28 for Action).
     */
    id: number;
    /**
     * The localized name of the genre (e.g., "Action", "Komödie").
     */
    name: string;
}

export interface TmdbGenreListDto {
    /**
     * An array of official TMDB genres.
     */
    genres: TmdbGenreDto[];
}