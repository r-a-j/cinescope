import { MovieSearchResult } from "./movie-search.model"

export interface MovieUpcomingModel {
    dates: Dates
    page: number
    results: MovieSearchResult[]
    total_pages: number
    total_results: number
}

export interface Dates {
    maximum: string
    minimum: string
}