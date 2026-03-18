export interface TmdbVideoDto {
    /** The unique string ID for this video on TMDB. */
    id: string;
    /** The ISO-639-1 language code (e.g., 'en'). */
    iso_639_1: string;
    /** The ISO-3166-1 country code (e.g., 'US'). */
    iso_3166_1: string;
    /** The unique video key used by the hosting site (e.g., the YouTube video ID). */
    key: string;
    /** The title of the video (e.g., 'Official Trailer'). */
    name: string;
    /** The hosting platform (usually 'YouTube' or 'Vimeo'). */
    site: string;
    /** The resolution/size of the video (e.g., 720, 1080). */
    size: number;
    /** The type of video (e.g., 'Trailer', 'Teaser', 'Featurette', 'Behind the Scenes', 'Bloopers'). */
    type: string;
    /** Whether this is an officially released video from the studio. */
    official: boolean;
    /** The ISO-8601 timestamp of when the video was published. */
    published_at: string;
}

export interface TmdbTvVideosResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The array of video objects. */
    results: TmdbVideoDto[];
}