import { TmdbKeywordDto } from '../keywords/keyword.dto';

export interface TmdbMovieKeywordsResponseDto {
    /**
     * The TMDB Movie ID.
     */
    id: number;
    /**
     * The list of keywords associated with the movie.
     */
    keywords: TmdbKeywordDto[];
}