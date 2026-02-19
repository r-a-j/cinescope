import { Genre } from "./movie/movie-detail.model";

export interface ContentModel {
    contentId: number;
    isMovie: boolean;
    isTv: boolean;
    isWatched: boolean;
    isWatchlist: boolean;
    title?: string;
    name?: string;
    poster_path?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
    genres?: Genre[];
    watchedAt?: string;
}