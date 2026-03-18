export interface TmdbCompanyAlternativeNameItemDto {
    name: string;
    type: string;
}

export interface TmdbCompanyAlternativeNamesDto {
    id: number;
    results: TmdbCompanyAlternativeNameItemDto[];
}