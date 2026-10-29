import { TmdbTvSeasonEpisodeDto } from '../tv-seasons/tv-season-detail.dto';
import { TmdbTvEpisodeImagesResponseDto } from './tv-episode-images.dto';
import { TmdbTvEpisodeVideosResponseDto } from './tv-episode-videos.dto';

/**
 * The detailed response for a single TV episode.
 * Extends the episode schema with optional appended images and videos payloads.
 */
export interface TmdbTvEpisodeDetailDto extends TmdbTvSeasonEpisodeDto {
    images?: TmdbTvEpisodeImagesResponseDto;
    videos?: TmdbTvEpisodeVideosResponseDto;
}
