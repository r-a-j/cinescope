export interface TmdbPersonCreditBaseDto {
    adult: boolean;
    backdrop_path: string | null;
    genre_ids: number[];
    id: number;
    original_language: string;
    overview: string;
    popularity: number;
    poster_path: string | null;
    vote_average: number;
    vote_count: number;
    credit_id: string;
    /**
     * Determines whether this credit is a movie or a tv show.
     */
    media_type: 'movie' | 'tv';

    // --- Movie Specific Properties ---
    title?: string;
    original_title?: string;
    release_date?: string;
    video?: boolean;

    // --- TV Show Specific Properties ---
    name?: string;
    original_name?: string;
    first_air_date?: string;
    episode_count?: number;
    origin_country?: string[];
}

export interface TmdbPersonCastCreditDto extends TmdbPersonCreditBaseDto {
    /**
     * The name of the character they played.
     */
    character: string;
    /**
     * Their billing order on the cast list (often missing or 0 for uncredited/background roles).
     */
    order?: number;
}

export interface TmdbPersonCrewCreditDto extends TmdbPersonCreditBaseDto {
    /**
     * The department they worked in (e.g., 'Directing', 'Production', 'Writing').
     */
    department: string;
    /**
     * Their specific job title (e.g., 'Director', 'Executive Producer').
     */
    job: string;
}

export interface TmdbPersonCombinedCreditsResponseDto {
    /**
     * The TMDB Person ID.
     */
    id: number;
    /**
     * The list of media the person has appeared in as a cast member.
     */
    cast: TmdbPersonCastCreditDto[];
    /**
     * The list of media the person has worked on behind the scenes.
     */
    crew: TmdbPersonCrewCreditDto[];
}