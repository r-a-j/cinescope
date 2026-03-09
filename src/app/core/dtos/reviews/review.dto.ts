export interface TmdbAuthorDetailsDto {
    /**
     * The display name of the author. Can be an empty string.
     */
    name: string;
    /**
     * The TMDB username of the author.
     */
    username: string;
    /**
     * The path to the user's avatar image. Can be null.
     */
    avatar_path: string | null;
    /**
     * The rating the author gave the movie (usually out of 10). Can be null if they just left a text review.
     */
    rating: number | null;
}

export interface TmdbReviewDto {
    /**
     * The name or username of the author.
     */
    author: string;
    /**
     * Detailed information about the author.
     */
    author_details: TmdbAuthorDetailsDto;
    /**
     * The actual text content of the review.
     */
    content: string;
    /**
     * The ISO-8601 timestamp of when the review was created.
     */
    created_at: string;
    /**
     * The unique TMDB ID for this specific review.
     */
    id: string;
    /**
     * The ISO-8601 timestamp of when the review was last updated.
     */
    updated_at: string;
    /**
     * The direct URL to the review on TMDB's website.
     */
    url: string;
}