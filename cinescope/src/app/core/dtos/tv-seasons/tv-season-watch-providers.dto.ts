// tv-season-watch-providers.dto.ts
import { TmdbWatchProviderCountryDto } from '../tv/tv-watch-providers.dto';

export interface TmdbTvSeasonWatchProvidersResponseDto {
    /** The TMDB Season ID. */
    id: number;
    /** A dictionary of streaming availability data keyed by ISO-3166-1 country code. */
    results: Record<string, TmdbWatchProviderCountryDto>;
}