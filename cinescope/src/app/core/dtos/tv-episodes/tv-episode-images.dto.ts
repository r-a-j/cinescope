// tv-episode-images.dto.ts
import { TmdbImageItemDto } from '../tv/tv-images.dto';

export interface TmdbTvEpisodeImagesResponseDto {
    /** The TMDB Episode ID. */
    id: number;
    /** * The array of still images from the episode. 
     * Note: TMDB refers to these as 'stills' for episodes.
     */
    stills: TmdbImageItemDto[];
}