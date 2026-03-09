export interface TmdbTvSeasonCrewDto {
    /** The department the crew member worked in (e.g., 'Directing', 'Writing'). */
    department: string;
    /** The specific job title (e.g., 'Director', 'Writer'). */
    job: string;
    credit_id: string;
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
}

export interface TmdbTvSeasonGuestStarDto {
    /** The name of the character the guest star played. */
    character: string;
    credit_id: string;
    order: number;
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
}

export interface TmdbTvSeasonEpisodeDto {
    /** The date the episode originally aired. */
    air_date: string;
    /** The sequential number of the episode within the season. */
    episode_number: number;
    /** The type of episode (e.g., 'standard', 'finale'). */
    episode_type: string;
    id: number;
    /** The title of the episode. */
    name: string;
    /** A brief synopsis of the episode's plot. */
    overview: string;
    production_code: string;
    /** The runtime of the episode in minutes. */
    runtime: number | null;
    /** The season number this episode belongs to. */
    season_number: number;
    /** The ID of the parent TV show. */
    show_id: number;
    /** A path to a still image from the episode. */
    still_path: string | null;
    vote_average: number;
    vote_count: number;
    /** The specific crew members (like directors and writers) for this episode. */
    crew: TmdbTvSeasonCrewDto[];
    /** The guest stars appearing in this specific episode. */
    guest_stars: TmdbTvSeasonGuestStarDto[];
}

export interface TmdbTvSeasonDetailDto {
    /** The internal string ID used by TMDB. */
    _id: string;
    /** The date the season originally premiered. */
    air_date: string;
    /** The list of all episodes contained within this season. */
    episodes: TmdbTvSeasonEpisodeDto[];
    /** The title of the season (e.g., 'Season 1'). */
    name: string;
    /** A brief synopsis of the season's overarching plot. */
    overview: string;
    id: number;
    /** A path to the official poster for this specific season. */
    poster_path: string | null;
    /** The sequential number of the season. */
    season_number: number;
    /** The average rating across all episodes in the season. */
    vote_average: number;
}