import { TmdbVideoDto } from '../common/video.dto';

export { TmdbVideoDto };

export interface TmdbTvVideosResponseDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The array of video objects. */
    results: TmdbVideoDto[];
}
