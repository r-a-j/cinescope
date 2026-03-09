export interface TmdbMovieCastMemberDto {
    adult: boolean;
    gender: number; // 0: Not specified, 1: Female, 2: Male, 3: Non-binary
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    cast_id: number;
    character: string;
    credit_id: string;
    order: number;
}

export interface TmdbMovieCrewMemberDto {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: string | null;
    credit_id: string;
    department: string;
    job: string;
}

export interface TmdbMovieCreditsResponseDto {
    id: number;
    cast: TmdbMovieCastMemberDto[];
    crew: TmdbMovieCrewMemberDto[];
}