// tv-season-aggregate-credits.dto.ts
import { TmdbTvAggregateCastDto, TmdbTvAggregateCrewDto } from '../tv/tv-aggregate-credits.dto';

export interface TmdbTvSeasonAggregateCreditsResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** The aggregated cast list rolled up across all episodes in this specific season. */
    cast: TmdbTvAggregateCastDto[];
    /** The aggregated crew list rolled up across all episodes in this specific season. */
    crew: TmdbTvAggregateCrewDto[];
}