import { TmdbImageDto } from '../common/image.dto';

/**
 * Re-export TmdbImageDto as TmdbImageItemDto for backwards compatibility.
 */
export type TmdbImageItemDto = TmdbImageDto;

export interface TmdbTvImagesResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** An array of horizontal background wallpapers. */
    backdrops: TmdbImageDto[];
    /** An array of official transparent title logos. */
    logos: TmdbImageDto[];
    /** An array of vertical promotional posters. */
    posters: TmdbImageDto[];
}
