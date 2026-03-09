// tv-season-images.dto.ts
import { TmdbImageItemDto } from '../tv/tv-images.dto';

export interface TmdbTvSeasonImagesResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** The array of vertical posters specifically associated with this season. */
    posters: TmdbImageItemDto[];
}