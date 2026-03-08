export interface TmdbPersonChangeItemDto {
    /**
     * The unique identifier for this specific change event.
     */
    id: string;
    /**
     * The action taken (e.g., 'added', 'updated', 'deleted').
     */
    action: string;
    /**
     * The timestamp of the change (e.g., '2023-03-05 10:06:41 UTC').
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
     * This is polymorphic depending on the 'key' (e.g., a string for a biography, or an object for an image).
     */
    value: any;
}

export interface TmdbPersonChangeGroupDto {
    /**
     * The property of the person that was changed (e.g., 'biography', 'translations', 'profiles').
     */
    key: string;
    /**
     * The list of specific changes made to this property.
     */
    items: TmdbPersonChangeItemDto[];
}

export interface TmdbPersonChangesResponseDto {
    /**
     * The list of grouped changes for the person.
     */
    changes: TmdbPersonChangeGroupDto[];
}