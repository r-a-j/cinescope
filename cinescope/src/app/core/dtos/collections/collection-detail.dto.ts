import { TmdbMovieListItemDto } from "../movies/movie-list-item.dto";


export interface TmdbCollectionDetailDto {
    id: number;
    name: string;
    original_language: string;
    original_name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    /**
     * An array of movies that belong to this collection.
     */
    parts: TmdbMovieListItemDto[];
}