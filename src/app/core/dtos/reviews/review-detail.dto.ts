import { TmdbReviewDto } from './review.dto';

export interface TmdbReviewDetailDto extends TmdbReviewDto {
    /**
     * The ISO-639-1 language code of the review.
     */
    iso_639_1: string;
    /**
     * The TMDB ID of the movie or TV show this review is for.
     */
    media_id: number;
    /**
     * The title of the movie or TV show.
     */
    media_title: string;
    /**
     * The type of media ('movie' or 'tv').
     */
    media_type: 'movie' | 'tv';
}