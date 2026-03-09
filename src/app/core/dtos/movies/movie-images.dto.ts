import { TmdbImageDto } from '../common/image.dto';

export interface TmdbMovieImagesResponseDto {
    id: number;
    backdrops: TmdbImageDto[];
    logos: TmdbImageDto[];
    posters: TmdbImageDto[];
}