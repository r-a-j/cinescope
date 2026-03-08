export interface TmdbTvChangeItemDto {
    /** The unique identifier for this specific change event. */
    id: string;
    /** The action taken (e.g., 'added', 'updated', 'deleted'). */
    action: string;
    /** The timestamp of the change. */
    time: string;
    /** Optional ISO 639-1 language code associated with the change. */
    iso_639_1?: string;
    /** Optional ISO 3166-1 country code associated with the change. */
    iso_3166_1?: string;
    /** The new value that was set. */
    value: any;
    /** The previous value before the change was made. */
    original_value?: any;
}

export interface TmdbTvChangeGroupDto {
    /** The property of the TV show that was changed (e.g., 'overview', 'poster', 'season', 'episode'). */
    key: string;
    /** The list of specific changes made to this property. */
    items: TmdbTvChangeItemDto[];
}

export interface TmdbTvChangesResponseDto {
    /** The list of grouped changes for the TV show. */
    changes: TmdbTvChangeGroupDto[];
}