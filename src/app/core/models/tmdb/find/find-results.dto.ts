import { TmdbMovieListItemDto } from '../movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../tv/tv-list-item.dto';

export interface TmdbPersonListItemDto {
    adult: boolean;
    id: number;
    name: string;
    original_name: string;
    media_type: string;
    popularity: number;
    gender: number;
    known_for_department: string;
    profile_path: string | null;
    known_for: (TmdbMovieListItemDto | TmdbTvListItemDto)[];
}

export interface TmdbTvEpisodeResultDto {
    id: number;
    name: string;
    overview: string;
    vote_average: number;
    vote_count: number;
    air_date: string;
    episode_number: number;
    episode_type: string;
    production_code: string;
    runtime: number | null;
    season_number: number;
    show_id: number;
    still_path: string | null;
}

export interface TmdbTvSeasonResultDto {
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
    show_id: number;
}

export interface TmdbFindResultsDto {
    movie_results: TmdbMovieListItemDto[];
    person_results: TmdbPersonListItemDto[];
    tv_results: TmdbTvListItemDto[];
    tv_episode_results: TmdbTvEpisodeResultDto[];
    tv_season_results: TmdbTvSeasonResultDto[];
}