import { TmdbMovieListItemDto } from '../movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../tv/tv-list-item.dto';

export interface TmdbPersonListItemDto {
    /**
     * Whether the person is known for adult content.
     */
    adult: boolean;
    /**
     * The person's gender. (0: Not specified, 1: Female, 2: Male, 3: Non-binary)
     */
    gender: number;
    /**
     * The unique TMDB ID for the person.
     */
    id: number;
    /**
     * The department they are most known for (e.g., 'Acting', 'Directing').
     */
    known_for_department: string;
    /**
     * The name of the person (e.g., 'Ana de Armas').
     */
    name: string;
    /**
     * The original name of the person.
     */
    original_name?: string;
    /**
     * The popularity score of the person on TMDB.
     */
    popularity: number;
    /**
     * The path to the person's profile image.
     */
    profile_path: string | null;
    /**
     * A mixed array of the movies and TV shows this person is most known for.
     */
    known_for: (TmdbMovieListItemDto | TmdbTvListItemDto)[];
}