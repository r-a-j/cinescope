export interface TmdbVideoDto {
    /**
     * The ISO-639-1 language code.
     */
    iso_639_1: string;
    /**
     * The ISO-3166-1 country code.
     */
    iso_3166_1: string;
    /**
     * The title of the video (e.g., "Fight Club (1999) Trailer").
     */
    name: string;
    /**
     * The video key/ID used by the hosting site (e.g., the YouTube video ID "O-b2VfmmbyA").
     */
    key: string;
    /**
     * The hosting site (e.g., "YouTube", "Vimeo").
     */
    site: string;
    /**
     * The resolution size of the video (e.g., 720, 1080).
     */
    size: number;
    /**
     * The type of video (e.g., "Trailer", "Teaser", "Clip", "Featurette", "Behind the Scenes").
     */
    type: string;
    /**
     * Whether this is an official release from the studio.
     */
    official: boolean;
    /**
     * The ISO-8601 timestamp of when the video was published.
     */
    published_at: string;
    /**
     * The TMDB internal ID for this video record.
     */
    id: string;
}