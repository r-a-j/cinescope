import { TmdbPersonImagesResponseDto } from './person-images.dto';

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

    /** Strongly typed appended images. */
    images?: TmdbPersonImagesResponseDto;

    /**
     * Optional field to accommodate additional `append_to_response` payloads
     * (e.g., if you append 'combined_credits', response.combined_credits will exist here).
     */
    [key: string]: unknown;
}
