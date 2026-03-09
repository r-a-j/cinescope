export interface TmdbNetworkAlternativeNameDto {
    /**
     * The alternative name of the network (e.g., "Home Box Office").
     */
    name: string;
    /**
     * The type or context of the alternative name.
     */
    type: string;
}

export interface TmdbNetworkAlternativeNamesResponseDto {
    /**
     * The TMDB Network ID.
     */
    id: number;
    /**
     * The list of alternative names for this network.
     */
    results: TmdbNetworkAlternativeNameDto[];
}