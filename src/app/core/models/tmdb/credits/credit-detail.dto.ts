export interface TmdbCreditMediaSeasonDto {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
    show_id: number;
}

export interface TmdbCreditMediaDto {
    adult: boolean;
    backdrop_path: string | null;
    id: number;

    // Movie fields
    title?: string;
    original_title?: string;
    release_date?: string;

    // TV fields
    name?: string;
    original_name?: string;
    first_air_date?: string;
    origin_country?: string[];
    episodes?: any[];
    seasons?: TmdbCreditMediaSeasonDto[];

    // Common fields
    original_language: string;
    overview: string;
    poster_path: string | null;
    media_type: string;
    genre_ids: number[];
    popularity: number;
    vote_average: number;
    vote_count: number;

    // Credit-specific contextual data
    character?: string;
}

export interface TmdbCreditPersonDto {
    adult: boolean;
    id: number;
    name: string;
    original_name: string;
    media_type: string;
    popularity: number;
    gender: number;
    known_for_department: string;
    profile_path: string | null;
}

export interface TmdbCreditDetailDto {
    credit_type: string;
    department: string;
    job: string;
    media: TmdbCreditMediaDto;
    media_type: string;
    id: string;
    person: TmdbCreditPersonDto;
}