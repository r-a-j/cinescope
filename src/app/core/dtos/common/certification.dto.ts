export interface TmdbCertificationItemDto {
    certification: string;
    meaning: string;
    order: number;
}

export interface TmdbCertificationResponseDto {
    /**
     * A dictionary of certifications grouped by ISO 3166-1 country codes (e.g., 'US', 'GB', 'IN').
     */
    certifications: Record<string, TmdbCertificationItemDto[]>;
}