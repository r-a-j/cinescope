import { TmdbImageItemDto } from '../common/image-item.dto';

export interface TmdbCollectionImagesDto {
    id: number;
    /**
     * Background images/wallpapers. Typically 16:9 aspect ratio.
     */
    backdrops: TmdbImageItemDto[];
    /**
     * Vertical poster images. Typically 2:3 aspect ratio.
     */
    posters: TmdbImageItemDto[];
}