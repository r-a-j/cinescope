import { TmdbVideoDto } from '../common/video.dto';

export interface TmdbMovieVideosResponseDto {
    /**
     * The TMDB Movie ID.
     */
    id: number;
    /**
     * The list of videos associated with the movie.
     */
    results: TmdbVideoDto[];
}