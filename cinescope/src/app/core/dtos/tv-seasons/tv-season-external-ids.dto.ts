// tv-season-external-ids.dto.ts
export interface TmdbTvSeasonExternalIdsDto {
    /** The TMDB Season ID. */
    id: number;
    /** The season's Freebase ID. */
    freebase_id: string | null;
    /** The season's Freebase MID. */
    freebase_mid: string | null;
    /** The season's TVDB ID. */
    tvdb_id: number | null;
    /** The season's TVRage ID. */
    tvrage_id: number | null;
    /** The season's Wikidata ID. */
    wikidata_id: string | null;
}