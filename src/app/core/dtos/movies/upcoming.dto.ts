import { TmdbMovieListItemDto } from './movie-list-item.dto';

export interface TmdbUpcomingDatesDto {
    /**
     * The maximum release date considered for the "Upcoming" window (Format: YYYY-MM-DD).
     */
    maximum: string;
    /**
     * The minimum release date considered for the "Upcoming" window (Format: YYYY-MM-DD).
     */
    minimum: string;
}

export interface TmdbUpcomingResponseDto {
    dates: TmdbUpcomingDatesDto;
    page: number;
    results: TmdbMovieListItemDto[];
    total_pages: number;
    total_results: number;
}