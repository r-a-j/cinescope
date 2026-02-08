import { Genre } from "./movie/movie-detail.model";

export interface ContentModel {
    contentId: number;
    isMovie: boolean;
    isTv: boolean;
    isWatched: boolean;
    isWatchlist: boolean;

    // Cached Display Data (to avoid N+1 API calls)
    title?: string;        // Movie title
    name?: string;         // TV name
    poster_path?: string;
    vote_average?: number;
    release_date?: string; // Movie
    first_air_date?: string; // TV
    genres?: Genre[];
}