// tv-episode-changes.dto.ts
import { TmdbTvChangeGroupDto } from '../tv/tv-changes.dto';

export interface TmdbTvEpisodeChangesResponseDto {
    /** The list of grouped changes for the TV episode. */
    changes: TmdbTvChangeGroupDto[];
}