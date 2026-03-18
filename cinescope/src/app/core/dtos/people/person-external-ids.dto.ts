export interface TmdbPersonExternalIdsDto {
    /**
     * The TMDB Person ID.
     */
    id: number;
    /**
     * The actor's IMDb profile ID (e.g., 'nm0000158').
     */
    imdb_id: string | null;
    /**
     * The actor's Facebook handle.
     */
    facebook_id: string | null;
    /**
     * The actor's Instagram handle.
     */
    instagram_id: string | null;
    /**
     * The actor's Twitter (X) handle.
     */
    twitter_id: string | null;
    /**
     * The actor's TikTok handle.
     */
    tiktok_id: string | null;
    /**
     * The actor's YouTube channel ID or handle.
     */
    youtube_id: string | null;
    /**
     * The actor's Wikidata ID.
     */
    wikidata_id: string | null;
    /**
     * Legacy TVRage ID.
     */
    tvrage_id: number | null;
    /**
     * Legacy Freebase ID.
     */
    freebase_id: string | null;
    /**
     * Legacy Freebase MID.
     */
    freebase_mid: string | null;
}