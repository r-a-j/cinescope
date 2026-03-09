export interface TmdbParentCompanyDto {
    name: string;
    id: number;
    logo_path: string | null;
}

export interface TmdbCompanyDetailDto {
    description: string;
    headquarters: string;
    homepage: string;
    id: number;
    logo_path: string | null;
    name: string;
    origin_country: string;
    parent_company: TmdbParentCompanyDto | null;
}