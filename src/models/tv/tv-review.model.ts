export interface TvReviewModel {
    id: number
    page: number
    results: TvReviewResult[]
    total_pages: number
    total_results: number
}

export interface TvReviewResult {
    author: string
    author_details: AuthorDetails
    content: string
    created_at: string
    id: string
    updated_at: string
    url: string
}

export interface AuthorDetails {
    name: string
    username: string
    avatar_path?: string
    rating: number
}
