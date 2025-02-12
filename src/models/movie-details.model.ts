export interface MovieDetails {
    adult: boolean;
    backdrop_path: string;
    belongs_to_collection: BelongsToCollection;
    budget: number;
    genres: Genre[];
    homepage: string;
    id: number;
    imdb_id: string;
    origin_country: OriginCountry[];
    original_language: OriginalLanguage;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string;
    production_companies: ProductionCompany[];
    production_countries: ProductionCountry[];
    release_date: Date;
    revenue: number;
    runtime: number;
    spoken_languages: SpokenLanguage[];
    status: string;
    tagline: string;
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
    images: Images;
    videos: Videos;
    recommendations: Recommendations;
    reviews: Reviews;
    similar: Recommendations;
    credits: Credits;
}

export interface BelongsToCollection {
    id: number;
    name: string;
    poster_path: string;
    backdrop_path: string;
}

export interface Credits {
    cast: Cast[];
    crew: Cast[];
}

export interface Cast {
    adult: boolean;
    gender: number;
    id: number;
    known_for_department: string;
    name: string;
    original_name: string;
    popularity: number;
    profile_path: null | string;
    cast_id?: number;
    character?: string;
    credit_id: string;
    order?: number;
    department?: string;
    job?: string;
}

export interface Genre {
    id: number;
    name: string;
}

export interface Images {
    backdrops: Backdrop[];
    logos: Backdrop[];
    posters: Backdrop[];
}

export interface Backdrop {
    aspect_ratio: number;
    height: number;
    iso_639_1: null | string;
    file_path: string;
    vote_average: number;
    vote_count: number;
    width: number;
}

export enum OriginCountry {
    Us = "US",
}

export enum OriginalLanguage {
    De = "de",
    En = "en",
    Fr = "fr",
    No = "no",
}

export interface ProductionCompany {
    id: number;
    logo_path: string;
    name: string;
    origin_country: string;
}

export interface ProductionCountry {
    iso_3166_1: string;
    name: string;
}

export interface Recommendations {
    page: number;
    results: RecommendationsResult[];
    total_pages: number;
    total_results: number;
}

export interface RecommendationsResult {
    backdrop_path: string;
    id: number;
    title: string;
    original_title: string;
    overview: string;
    poster_path: string;
    media_type?: MediaType;
    adult: boolean;
    original_language: OriginalLanguage;
    genre_ids: number[];
    popularity: number;
    release_date: Date;
    video: boolean;
    vote_average: number;
    vote_count: number;
}

export enum MediaType {
    Movie = "movie",
}

export interface Reviews {
    page: number;
    results: ReviewsResult[];
    total_pages: number;
    total_results: number;
}

export interface ReviewsResult {
    author: string;
    author_details: AuthorDetails;
    content: string;
    created_at: Date;
    id: string;
    updated_at: Date;
    url: string;
}

export interface AuthorDetails {
    name: string;
    username: string;
    avatar_path: string;
    rating: number;
}

export interface SpokenLanguage {
    english_name: string;
    iso_639_1: OriginalLanguage;
    name: string;
}

export interface Videos {
    results: VideosResult[];
}

export interface VideosResult {
    iso_639_1: OriginalLanguage;
    iso_3166_1: OriginCountry;
    name: string;
    key: string;
    site: Site;
    size: number;
    type: Type;
    official: boolean;
    published_at: Date;
    id: string;
}

export enum Site {
    YouTube = "YouTube",
}

export enum Type {
    BehindTheScenes = "Behind the Scenes",
    Clip = "Clip",
    Featurette = "Featurette",
    Teaser = "Teaser",
    Trailer = "Trailer",
}