export interface TmdbMovieChangeItemDto {
    /**
     * The unique identifier for this specific change event.
     */
    id: string;
    /**
     * The action taken (e.g., 'added', 'updated', 'deleted').
     */
    action: string;
    /**
     * The timestamp of the change (e.g., '2023-04-08 16:35:05 UTC').
     */
    time: string;
    /**
     * Optional ISO 639-1 language code associated with the change.
     */
    iso_639_1: string;
    /**
     * Optional ISO 3166-1 country code associated with the change.
     */
    iso_3166_1: string;
    /**
     * The actual value that was changed. 
     * This is highly polymorphic depending on the 'key' (e.g., a poster object, a string, a keyword object).
     */
    value: any;
}

export interface TmdbMovieChangeGroupDto {
    /**
     * The property of the movie that was changed (e.g., 'images', 'plot_keywords', 'overview').
     */
    key: string;
    /**
     * The list of specific changes made to this property.
     */
    items: TmdbMovieChangeItemDto[];
}

export interface TmdbMovieChangesResponseDto {
    /**
     * The list of grouped changes for the movie.
     */
    changes: TmdbMovieChangeGroupDto[];
}