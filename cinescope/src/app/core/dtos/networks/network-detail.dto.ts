export interface TmdbNetworkDetailDto {
    /**
     * The headquarters location of the network (e.g., "New York City, New York").
     */
    headquarters: string;
    /**
     * The official website URL of the network.
     */
    homepage: string;
    /**
     * The unique TMDB ID for the network (e.g., 49 for HBO).
     */
    id: number;
    /**
     * The path to the network's logo image.
     */
    logo_path: string | null;
    /**
     * The name of the network (e.g., "HBO").
     */
    name: string;
    /**
     * The ISO-3166-1 origin country code for the network (e.g., "US").
     */
    origin_country: string;
}