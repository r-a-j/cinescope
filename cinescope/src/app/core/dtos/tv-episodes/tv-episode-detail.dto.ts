import { TmdbTvSeasonEpisodeDto } from '../tv-seasons/tv-season-detail.dto';
import { TmdbTvEpisodeImagesResponseDto } from './tv-episode-images.dto';
import { TmdbTvEpisodeVideosResponseDto } from './tv-episode-videos.dto';
import { TmdbTvEpisodeCreditsResponseDto } from './tv-episode-credits.dto';
import { TmdbTvEpisodeExternalIdsDto } from './tv-episode-external-ids.dto';

/**
 * The detailed response for a single TV episode.
 * Extends the episode schema with optional appended images, videos, credits, and external IDs payloads.
 */
export interface TmdbTvEpisodeDetailDto extends TmdbTvSeasonEpisodeDto {
    images?: TmdbTvEpisodeImagesResponseDto;
    videos?: TmdbTvEpisodeVideosResponseDto;
    credits?: TmdbTvEpisodeCreditsResponseDto;
    external_ids?: TmdbTvEpisodeExternalIdsDto;
    [key: string]: unknown;
}
