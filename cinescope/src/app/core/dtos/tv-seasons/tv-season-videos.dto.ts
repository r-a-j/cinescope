import { TmdbVideoDto } from '../common/video.dto';

export interface TmdbTvSeasonVideosResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** The array of video objects (trailers, recaps) for the season. */
    results: TmdbVideoDto[];
}
