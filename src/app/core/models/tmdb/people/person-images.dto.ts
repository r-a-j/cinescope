import { TmdbImageDto } from '../common/image.dto';

export interface TmdbPersonImagesResponseDto {
    /**
     * The TMDB Person ID.
     */
    id: number;
    /**
     * The list of profile images that have been added to the person.
     */
    profiles: TmdbImageDto[];
}