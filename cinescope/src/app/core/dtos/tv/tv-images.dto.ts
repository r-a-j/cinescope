export interface TmdbImageItemDto {
    /** The aspect ratio of the image. */
    aspect_ratio: number;
    /** The height of the image in pixels. */
    height: number;
    /** The ISO-639-1 language code associated with the image, if any. */
    iso_639_1: string | null;
    /** The file path to the image. Append this to the TMDB image base URL (e.g., 'https://image.tmdb.org/t/p/original/...'). */
    file_path: string;
    /** The average rating given to this image by the TMDB community. */
    vote_average: number;
    /** The number of votes this image has received. */
    vote_count: number;
    /** The width of the image in pixels. */
    width: number;
}

export interface TmdbTvImagesResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** An array of horizontal background wallpapers. */
    backdrops: TmdbImageItemDto[];
    /** An array of official transparent title logos. */
    logos: TmdbImageItemDto[];
    /** An array of vertical promotional posters. */
    posters: TmdbImageItemDto[];
}