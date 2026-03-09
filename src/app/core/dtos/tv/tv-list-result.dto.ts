export interface TmdbTvListResultDto {
    /** The description of the list created by the user. */
    description: string;
    /** The number of favorites or likes this list has received. */
    favorite_count: number;
    /** The unique TMDB ID for the list. */
    id: number;
    /** The total number of items (shows/movies) contained in this list. */
    item_count: number;
    /** The ISO-639-1 language code of the list. */
    iso_639_1: string;
    /** The ISO-3166-1 country code of the list. */
    iso_3166_1: string;
    /** The title of the list (e.g., 'Best Sci-Fi of the Decade'). */
    name: string;
    /** The poster path for the list. */
    poster_path: string | null;
}