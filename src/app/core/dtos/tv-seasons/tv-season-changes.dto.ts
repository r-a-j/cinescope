// tv-season-changes.dto.ts
import { TmdbTvChangeGroupDto } from '../tv/tv-changes.dto';

export interface TmdbTvSeasonChangesResponseDto {
    /** The list of grouped changes for the TV season. */
    changes: TmdbTvChangeGroupDto[];
}