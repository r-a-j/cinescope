export interface PersonCreditsModel {
    cast: PersonCastCredit[];
    crew: PersonCrewCredit[];
    id: number;
}

export interface PersonCastCredit {
    adult: boolean;
    backdrop_path?: string;
    genre_ids: number[];
    id: number;
    original_language: string;
    original_title?: string;
    original_name?: string;
    overview: string;
    popularity: number;
    poster_path?: string;
    release_date?: string;
    first_air_date?: string;
    title?: string;
    name?: string;
    video?: boolean;
    vote_average: number;
    vote_count: number;
    character: string;
    credit_id: string;
    order?: number;
    media_type?: string;
}

export interface PersonCrewCredit {
    adult: boolean;
    backdrop_path?: string;
    genre_ids: number[];
    id: number;
    original_language: string;
    original_title?: string;
    original_name?: string;
    overview: string;
    popularity: number;
    poster_path?: string;
    release_date?: string;
    first_air_date?: string;
    title?: string;
    name?: string;
    video?: boolean;
    vote_average: number;
    vote_count: number;
    credit_id: string;
    department: string;
    job: string;
    media_type?: string;
}
