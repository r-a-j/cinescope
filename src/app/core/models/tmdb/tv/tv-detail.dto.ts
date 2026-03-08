import { TmdbGenreDto } from '../genres/genre.dto';
import { TmdbProductionCompanyDto } from '../movies/movie-detail.dto';
import { TmdbProductionCountryDto } from '../movies/movie-detail.dto';
import { TmdbSpokenLanguageDto } from '../movies/movie-detail.dto';

export interface TmdbTvCreatorDto {
    id: number;
    credit_id: string;
    name: string;
    gender: number;
    profile_path: string | null;
}

export interface TmdbTvEpisodeBaseDto {
    id: number;
    name: string;
    overview: string;
    vote_average: number;
    vote_count: number;
    air_date: string;
    episode_number: number;
    production_code: string;
    runtime: number | null;
    season_number: number;
    show_id: number;
    still_path: string | null;
}

export interface TmdbTvNetworkDto {
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
}

export interface TmdbTvSeasonBaseDto {
    air_date: string | null;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
    vote_average: number;
}

export interface TmdbTvDetailDto {
    adult: boolean;
    backdrop_path: string | null;
    /** The people who created the series. */
    created_by: TmdbTvCreatorDto[];
    episode_run_time: number[];
    first_air_date: string;
    genres: TmdbGenreDto[];
    homepage: string | null;
    id: number;
    in_production: boolean;
    languages: string[];
    last_air_date: string;
    /** The most recent episode that aired. */
    last_episode_to_air: TmdbTvEpisodeBaseDto | null;
    name: string;
    /** The next upcoming episode (will be null if the show has ended or is between seasons). */
    next_episode_to_air: TmdbTvEpisodeBaseDto | null;
    /** The networks/streaming services the show airs on (e.g., HBO, Netflix). */
    networks: TmdbTvNetworkDto[];
    number_of_episodes: number;
    number_of_seasons: number;
    origin_country: string[];
    original_language: string;
    original_name: string;
    overview: string;
    popularity: number;
    poster_path: string | null;
    production_companies: TmdbProductionCompanyDto[];
    production_countries: TmdbProductionCountryDto[];
    /** A top-level summary of all the seasons. */
    seasons: TmdbTvSeasonBaseDto[];
    spoken_languages: TmdbSpokenLanguageDto[];
    /** The current status (e.g., 'Returning Series', 'Ended', 'Canceled'). */
    status: string;
    tagline: string;
    type: string;
    vote_average: number;
    vote_count: number;

    /** Optional catch-all for append_to_response. */
    [key: string]: any;
}