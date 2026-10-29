import { TmdbVideoDto } from '../common/video.dto';

export interface TmdbTvEpisodeVideosResponseDto {
    /** The TMDB Episode ID. */
    id: number;
    /** The array of video objects (Promos, Teasers, Behind the Scenes) for the episode. */
    results: TmdbVideoDto[];
}
