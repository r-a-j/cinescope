// tv-season-videos.dto.ts
import { TmdbVideoDto } from '../tv/tv-videos.dto';

export interface TmdbTvSeasonVideosResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** The array of video objects (trailers, recaps) for the season. */
    results: TmdbVideoDto[];
}