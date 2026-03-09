// tv-episode-external-ids.dto.ts
export interface TmdbTvEpisodeExternalIdsDto {
    /** The TMDB Episode ID. */
    id: number;
    /** The episode's IMDb ID (e.g., 'tt1480055'). */
    imdb_id: string | null;
    /** The episode's Freebase ID. */
    freebase_id: string | null;
    /** The episode's Freebase MID. */
    freebase_mid: string | null;
    /** The episode's TVDB ID. */
    tvdb_id: number | null;
    /** The episode's TVRage ID. */
    tvrage_id: number | null;
    /** The episode's Wikidata ID. */
    wikidata_id: string | null;
}