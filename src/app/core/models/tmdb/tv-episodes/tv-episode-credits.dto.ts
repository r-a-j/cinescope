// tv-episode-credits.dto.ts
import { TmdbTvCastDto, TmdbTvCrewDto } from '../tv/tv-credits.dto';
import { TmdbTvSeasonGuestStarDto } from '../tv-seasons/tv-season-detail.dto';

export interface TmdbTvEpisodeCreditsResponseDto {
    /** The TMDB Episode ID. */
    id: number;
    /** The main cast appearing in this episode. */
    cast: TmdbTvCastDto[];
    /** The specific crew (directors, writers) for this episode. */
    crew: TmdbTvCrewDto[];
    /** The one-off guest stars appearing specifically in this episode. */
    guest_stars: TmdbTvSeasonGuestStarDto[];
}