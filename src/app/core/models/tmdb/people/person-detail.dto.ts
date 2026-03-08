export interface TmdbPersonDetailDto {
    adult: boolean;
    also_known_as: string[];
    biography: string;
    birthday: string | null;
    deathday: string | null;
    /**
     * 0: Not set / not specified, 1: Female, 2: Male, 3: Non-binary
     */
    gender: number;
    homepage: string | null;
    id: number;
    imdb_id: string | null;
    known_for_department: string;
    name: string;
    place_of_birth: string | null;
    popularity: number;
    profile_path: string | null;

    /**
     * Optional field to accommodate the `append_to_response` feature.
     * (e.g., if you append 'movie_credits', response.movie_credits will exist here).
     */
    [key: string]: any;
}