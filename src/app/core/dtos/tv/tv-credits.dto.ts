export interface TmdbTvCastDto {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    /** The name of the character played in the latest season. */
    character: string;
    credit_id: string;
    order: number;
}

export interface TmdbTvCrewDto {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    credit_id: string;
    /** The department they worked in during the latest season. */
    department: string;
    /** Their specific job title during the latest season. */
    job: string;
}

export interface TmdbTvCreditsResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The cast list for the latest season. */
    cast: TmdbTvCastDto[];
    /** The crew list for the latest season. */
    crew: TmdbTvCrewDto[];
}