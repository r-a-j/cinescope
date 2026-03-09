export interface TmdbNetworkLogoDto {
    /**
     * The aspect ratio of the image.
     */
    aspect_ratio: number;
    /**
     * The path to the image file (e.g., "/tuomPhY2UtuPTqqFnKMVHvSb724.png").
     */
    file_path: string;
    /**
     * The height of the image in pixels.
     */
    height: number;
    /**
     * The unique string identifier for this specific image asset.
     */
    id: string;
    /**
     * The file extension/type (e.g., ".svg" or ".png").
     */
    file_type: string;
    /**
     * The average community vote for this image.
     */
    vote_average: number;
    /**
     * The number of votes this image has received.
     */
    vote_count: number;
    /**
     * The width of the image in pixels.
     */
    width: number;
}

export interface TmdbNetworkImagesResponseDto {
    /**
     * The TMDB Network ID.
     */
    id: number;
    /**
     * The list of logos available for this network.
     */
    logos: TmdbNetworkLogoDto[];
}