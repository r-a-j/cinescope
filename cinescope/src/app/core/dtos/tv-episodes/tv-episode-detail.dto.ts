import { TmdbTvSeasonEpisodeDto } from '../tv-seasons/tv-season-detail.dto';

/**
 * The detailed response for a single TV episode.
 * Because TMDB uses the exact same data structure here as it does in the Season Details array,
 * we can cleanly extend our existing DTO while adding any root-level keys if they ever change.
 */
export type TmdbTvEpisodeDetailDto = TmdbTvSeasonEpisodeDto;