import { TmdbGenreDto } from '../genres/genre.dto';

export interface TmdbBelongsToCollectionDto {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
}

export interface TmdbProductionCompanyDto {
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
}

export interface TmdbProductionCountryDto {
    iso_3166_1: string;
    name: string;
}

export interface TmdbSpokenLanguageDto {
    english_name: string;
    iso_639_1: string;
    name: string;
}

export interface TmdbMovieDetailDto {
    adult: boolean;
    backdrop_path: string | null;
    belongs_to_collection: TmdbBelongsToCollectionDto | null;
    budget: number;
    genres: TmdbGenreDto[];
    homepage: string | null;
    id: number;
    imdb_id: string | null;
    original_language: string;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string | null;
    production_companies: TmdbProductionCompanyDto[];
    production_countries: TmdbProductionCountryDto[];
    release_date: string;
    revenue: number;
    runtime: number | null;
    spoken_languages: TmdbSpokenLanguageDto[];
    status: string;
    tagline: string | null;
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;

    /**
     * Optional field to accommodate the `append_to_response` feature.
     * (e.g., if you append 'credits', response.credits will exist here).
     */
    [key: string]: any;
}