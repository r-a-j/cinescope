export interface TmdbTvEpisodeGroupNetworkDto {
    /** The TMDB Network ID. */
    id: number;
    /** The path to the network's logo. */
    logo_path: string | null;
    /** The name of the network (e.g., 'HBO'). */
    name: string;
    /** The origin country of the network. */
    origin_country: string;
}

export interface TmdbTvEpisodeGroupDto {
    /** A description of what this group represents (e.g., 'The official DVD release order'). */
    description: string;
    /** The total number of episodes contained within this group. */
    episode_count: number;
    /** The number of sub-groups (e.g., how many 'Arcs' or 'Volumes' there are). */
    group_count: number;
    /** The unique TMDB string ID for this specific group (e.g., '5b48b111c3a368307201c3de'). */
    id: string;
    /** The name of the group (e.g., 'Official DVD', 'Story Arc', 'Chronological'). */
    name: string;
    /** The network associated with this specific broadcast/release order, if any. */
    network: TmdbTvEpisodeGroupNetworkDto | null;
    /** The integer type of the group (e.g., 1 = Original Air Date, 2 = Absolute, 3 = DVD, 4 = Digital, 5 = Story Arc, 6 = Production, 7 = TV). */
    type: number;
}

export interface TmdbTvEpisodeGroupsResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The list of alternative episode groups. */
    results: TmdbTvEpisodeGroupDto[];
}