import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TmdbCompanyDetailDto } from '../dtos/companies/company-detail.dto';
import { TmdbCompanyAlternativeNamesDto } from '../dtos/companies/company-alternative-names.dto';
import { TmdbCompanyImagesDto } from '../dtos/companies/company-images.dto';
import { BaseMediaService } from './base-media.service';

@Injectable({ providedIn: 'root' })
export class TmdbCompaniesService extends BaseMediaService {
    /**
     * Get the company details by ID.
     * @param companyId The TMDB Company ID.
     */
    getCompanyDetails(companyId: number): Observable<TmdbCompanyDetailDto> {
        return this.http.get<TmdbCompanyDetailDto>(`${this.apiPrefix}/company/${companyId}`);
    }

    /**
     * Get the alternative names of a company.
     * @param companyId The TMDB Company ID.
     */
    getCompanyAlternativeNames(companyId: number): Observable<TmdbCompanyAlternativeNamesDto> {
        return this.http.get<TmdbCompanyAlternativeNamesDto>(`${this.apiPrefix}/company/${companyId}/alternative_names`);
    }

    /**
     * Get the company logos by id.
     * Note: Prefer SVGs (.svg) as they are resolution independent.
     * @param companyId The TMDB Company ID.
     */
    getCompanyImages(companyId: number): Observable<TmdbCompanyImagesDto> {
        return this.http.get<TmdbCompanyImagesDto>(`${this.apiPrefix}/company/${companyId}/images`);
    }
}