import { TmdbMovieListItemDto } from './movie-list-item.dto';

export interface TmdbNowPlayingDatesDto {
    /**
     * The maximum release date considered for the "Now Playing" window (Format: YYYY-MM-DD).
     */
    maximum: string;
    /**
     * The minimum release date considered for the "Now Playing" window (Format: YYYY-MM-DD).
     */
    minimum: string;
}

export interface TmdbNowPlayingResponseDto {
    dates: TmdbNowPlayingDatesDto;
    page: number;
    results: TmdbMovieListItemDto[];
    total_pages: number;
    total_results: number;
}