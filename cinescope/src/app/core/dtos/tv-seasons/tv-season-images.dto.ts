import { TmdbImageDto } from '../common/image.dto';

export interface TmdbTvSeasonImagesResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** The array of vertical posters specifically associated with this season. */
    posters: TmdbImageDto[];
}
