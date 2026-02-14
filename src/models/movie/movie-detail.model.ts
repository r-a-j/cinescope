export interface MovieDetailModel {
    adult?: boolean
    backdrop_path?: string
    belongs_to_collection?: BelongsToCollection
    budget?: number
    genres?: Genre[]
    homepage?: string
    id?: number
    imdb_id?: string
    origin_country?: string[]
    original_language?: string
    original_title?: string
    overview?: string
    popularity?: number
    poster_path?: string
    production_companies?: ProductionCompany[]
    production_countries?: ProductionCountry[]
    release_date?: string
    revenue?: number
    runtime?: number
    spoken_languages?: SpokenLanguage[]
    status?: string
    tagline?: string
    title?: string
    video?: boolean
    vote_average?: number
    vote_count?: number
    videos?: Videos
    recommendations?: Recommendations
    similar?: Similar
    images?: Images
}

export interface Images {
    backdrops?: Image[];
    logos?: Image[];
    posters?: Image[];
}

export interface Image {
    aspect_ratio?: number;
    height?: number;
    iso_639_1?: string | null;
    file_path?: string;
    vote_average?: number;
    vote_count?: number;
    width?: number;
}

export interface BelongsToCollection {
    id?: number
    name?: string
    poster_path?: string
    backdrop_path?: string
}

export interface Genre {
    id?: number
    name?: string
}

export interface ProductionCompany {
    id?: number
    logo_path?: string
    name?: string
    origin_country?: string
}

export interface ProductionCountry {
    iso_3166_1?: string
    name?: string
}

export interface SpokenLanguage {
    english_name?: string
    iso_639_1?: string
    name?: string
}

export interface Videos {
    results?: VideosResult[]
}

export interface VideosResult {
    iso_639_1?: string
    iso_3166_1?: string
    name?: string
    key?: string
    site?: string
    size?: number
    type?: string
    official?: boolean
    published_at?: string
    id?: string
}

export interface Recommendations {
    page?: number
    results?: RecommendationsResult[]
    total_pages?: number
    total_results?: number
}

export interface RecommendationsResult {
    backdrop_path?: string
    id?: number
    title?: string
    original_title?: string
    overview?: string
    poster_path?: string
    media_type?: string
    adult?: boolean
    original_language?: string
    genre_ids?: number[]
    popularity?: number
    release_date?: string
    video?: boolean
    vote_average?: number
    vote_count?: number
}

export interface Similar {
    page?: number
    results?: SimilarResult[]
    total_pages?: number
    total_results?: number
}

export interface SimilarResult {
    adult?: boolean
    backdrop_path?: string
    genre_ids?: number[]
    id?: number
    original_language?: string
    original_title?: string
    overview?: string
    popularity?: number
    poster_path?: string
    release_date?: string
    title?: string
    video?: boolean
    vote_average?: number
    vote_count?: number
}