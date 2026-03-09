import { TmdbKeywordDto } from '../keywords/keyword.dto';

export interface TmdbTvKeywordsResponseDto {
    /** The TMDB TV Show ID (e.g., 1399 for Game of Thrones). */
    id: number;
    /** The list of hyper-specific thematic keywords associated with the TV show. */
    results: TmdbKeywordDto[];
}