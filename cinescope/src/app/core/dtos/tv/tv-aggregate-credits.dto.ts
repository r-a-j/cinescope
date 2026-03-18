export interface TmdbTvAggregateRoleDto {
    /** The specific credit ID for this role. */
    credit_id: string;
    /** The name of the character played. */
    character: string;
    /** The number of episodes the actor appeared in as this specific character. */
    episode_count: number;
}

export interface TmdbTvAggregateJobDto {
    /** The specific credit ID for this job. */
    credit_id: string;
    /** The specific job title (e.g., 'Director', 'Production Design'). */
    job: string;
    /** The number of episodes the crew member performed this job for. */
    episode_count: number;
}

export interface TmdbTvAggregateCastDto {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    /** The array of different characters this actor played throughout the series. */
    roles: TmdbTvAggregateRoleDto[];
    /** The total number of episodes this actor appeared in across all their roles. */
    total_episode_count: number;
    /** The billing order of the actor. */
    order: number;
}

export interface TmdbTvAggregateCrewDto {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    /** The broad department they worked in (e.g., 'Art', 'Writing'). */
    department: string;
    /** The array of different specific jobs this crew member performed throughout the series. */
    jobs: TmdbTvAggregateJobDto[];
    /** The total number of episodes this crew member worked on. */
    total_episode_count: number;
}

export interface TmdbTvAggregateCreditsResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The aggregated cast list across all seasons. */
    cast: TmdbTvAggregateCastDto[];
    /** The aggregated crew list across all seasons. */
    crew: TmdbTvAggregateCrewDto[];
}