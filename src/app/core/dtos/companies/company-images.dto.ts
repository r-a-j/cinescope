export interface TmdbCompanyLogoDto {
    aspect_ratio: number;
    file_path: string;
    height: number;
    id: string; // Note: This is a string hash in the company endpoint, not a number
    file_type: string; // e.g., '.svg' or '.png'
    vote_average: number;
    vote_count: number;
    width: number;
}

export interface TmdbCompanyImagesDto {
    id: number;
    logos: TmdbCompanyLogoDto[];
}