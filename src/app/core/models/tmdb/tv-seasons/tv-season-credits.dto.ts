// tv-season-credits.dto.ts
import { TmdbTvCastDto, TmdbTvCrewDto } from '../tv/tv-credits.dto';

export interface TmdbTvSeasonCreditsResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** The core cast list for the season. */
    cast: TmdbTvCastDto[];
    /** The core crew list for the season. */
    crew: TmdbTvCrewDto[];
}