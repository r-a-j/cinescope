import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MEDIA_API_PREFIX } from '../constants/api.constants';

export abstract class BaseMediaService {
    protected http = inject(HttpClient);
    protected apiPrefix = MEDIA_API_PREFIX;

    /**
     * Safely converts a strictly-typed parameter object into Angular HttpParams,
     * automatically stripping out any undefined, null, or empty string values.
     */
    protected buildParams(params: Record<string, string | number | boolean | undefined | null>): HttpParams {
        let httpParams = new HttpParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                // Angular's HttpParams requires values to be serialized to strings
                httpParams = httpParams.set(key, value.toString());
            }
        });

        return httpParams;
    }
}