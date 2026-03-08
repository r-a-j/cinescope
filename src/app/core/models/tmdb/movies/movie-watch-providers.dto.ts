import { TmdbWatchProviderRegionDto } from '../watch-providers/watch-provider.dto';

export interface TmdbMovieWatchProvidersResponseDto {
    /**
     * The TMDB Movie ID.
     */
    id: number;
    /**
     * A dictionary mapping ISO-3166-1 country codes to their specific availability data.
     */
    results: {
        [countryCode: string]: TmdbWatchProviderRegionDto;
    };
}