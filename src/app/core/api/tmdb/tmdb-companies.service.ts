import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbCompanyDetailDto } from '../../models/tmdb/companies/company-detail.dto';
import { TmdbCompanyAlternativeNamesDto } from '../../models/tmdb/companies/company-alternative-names.dto';
import { TmdbCompanyImagesDto } from '../../models/tmdb/companies/company-images.dto';

@Injectable({ providedIn: 'root' })
export class TmdbCompaniesService {
    constructor(private http: HttpClient) { }

    /**
     * Get the company details by ID.
     * @param companyId The TMDB Company ID.
     */
    getCompanyDetails(companyId: number): Observable<TmdbCompanyDetailDto> {
        return this.http.get<TmdbCompanyDetailDto>(`/company/${companyId}`);
    }

    /**
     * Get the alternative names of a company.
     * @param companyId The TMDB Company ID.
     */
    getCompanyAlternativeNames(companyId: number): Observable<TmdbCompanyAlternativeNamesDto> {
        return this.http.get<TmdbCompanyAlternativeNamesDto>(`/company/${companyId}/alternative_names`);
    }

    /**
     * Get the company logos by id.
     * Note: Prefer SVGs (.svg) as they are resolution independent.
     * @param companyId The TMDB Company ID.
     */
    getCompanyImages(companyId: number): Observable<TmdbCompanyImagesDto> {
        return this.http.get<TmdbCompanyImagesDto>(`/company/${companyId}/images`);
    }
}