import { TmdbTvSeasonEpisodeDto } from '../tv-seasons/tv-season-detail.dto';
import { TmdbTvEpisodeGroupNetworkDto } from '../tv/tv-episode-groups.dto';

/**
 * The 7 different types of episode groups defined by TMDB.
 */
export enum TmdbTvEpisodeGroupType {
    OriginalAirDate = 1,
    Absolute = 2,
    DVD = 3,
    Digital = 4,
    StoryArc = 5,
    Production = 6,
    TV = 7
}

export interface TmdbTvEpisodeGroupEpisodeDto extends TmdbTvSeasonEpisodeDto {
    /** The sequential order of this episode within this specific alternative group. */
    order: number;
}

export interface TmdbTvEpisodeGroupBucketDto {
    /** The unique string ID for this specific bucket/arc. */
    id: string;
    /** The name of this bucket (e.g., 'The Cell Games Arc', 'Volume 1'). */
    name: string;
    /** The sequential order of this bucket within the larger group. */
    order: number;
    /** The array of episodes contained within this bucket, sorted by their new alternative order. */
    episodes: TmdbTvEpisodeGroupEpisodeDto[];
}

export interface TmdbTvEpisodeGroupDetailDto {
    /** The unique TMDB string ID for this episode group (e.g., '5eb9938b60e0a26346d0000ce'). */
    id: string;
    /** A description of what this group represents. */
    description: string;
    /** The total number of episodes contained across all buckets in this group. */
    episode_count: number;
    /** The number of sub-groups/buckets (e.g., how many 'Arcs' or 'Volumes' there are). */
    group_count: number;
    /** The actual buckets containing the re-ordered episodes. */
    groups: TmdbTvEpisodeGroupBucketDto[];
    /** The name of the group (e.g., 'Chronological Order', 'Official DVD Release'). */
    name: string;
    /** The network associated with this specific broadcast/release order, if any. */
    network: TmdbTvEpisodeGroupNetworkDto | null;
    /** The integer type of the group (1-7). */
    type: TmdbTvEpisodeGroupType;
}