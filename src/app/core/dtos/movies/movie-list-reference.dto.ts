export interface TmdbMovieListReferenceDto {
    description: string;
    favorite_count: number;
    id: number;
    item_count: number;
    iso_639_1: string;
    list_type: string; // e.g., 'movie'
    name: string;
    poster_path: string | null;
}