// tv-episode-videos.dto.ts
import { TmdbVideoDto } from '../tv/tv-videos.dto';

export interface TmdbTvEpisodeVideosResponseDto {
    /** The TMDB Episode ID. */
    id: number;
    /** The array of video objects (Promos, Teasers, Behind the Scenes) for the episode. */
    results: TmdbVideoDto[];
}