export interface TmdbTvExternalIdsDto {
    /** The TMDB TV Show ID. */
    id: number;
    /** The show's IMDb ID (e.g., 'tt0944947'). */
    imdb_id: string | null;
    /** The show's TVDB ID (e.g., 121361). */
    tvdb_id: number | null;
    /** Legacy TVRage ID. */
    tvrage_id: number | null;
    /** The show's Wikidata ID. */
    wikidata_id: string | null;
    /** Legacy Freebase ID. */
    freebase_id: string | null;
    /** Legacy Freebase MID. */
    freebase_mid: string | null;
    /** The show's official Facebook handle. */
    facebook_id: string | null;
    /** The show's official Instagram handle. */
    instagram_id: string | null;
    /** The show's official Twitter (X) handle. */
    twitter_id: string | null;
}