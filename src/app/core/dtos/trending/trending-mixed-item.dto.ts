import { TmdbMovieListItemDto } from '../movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../tv/tv-list-item.dto';
import { TmdbPersonListItemDto } from '../people/person-list-item.dto';

/**
 * A union type representing the possible items returned by the Trending All endpoint.
 * You can discriminate these by checking the 'media_type' property.
 */
export type TmdbTrendingMixedItemDto =
    | (TmdbMovieListItemDto & { media_type: 'movie' })
    | (TmdbTvListItemDto & { media_type: 'tv' })
    | (TmdbPersonListItemDto & { media_type: 'person' });