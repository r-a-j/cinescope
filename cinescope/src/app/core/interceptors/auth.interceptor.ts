import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { ApiCacheService, CACHE_TTL } from '../services/api-cache.service';
import { environment } from '../../../environments/environment';
import { CINESCOPE_CLIENT_HEADER, MEDIA_API_PREFIX } from '../constants/api.constants';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
    const storageService = inject(StorageService);
    const apiCache = inject(ApiCacheService);

    if (req.url.startsWith(MEDIA_API_PREFIX)) {
        let cloneParams = req.params;
        const targetPath = req.url.replace(MEDIA_API_PREFIX, '');

        if (targetPath.includes('search') || targetPath.includes('discover')) {
            cloneParams = cloneParams.set('include_adult', String(storageService.allowAdultContent()));
        }

        const clonedRequest = req.clone({
            url: `${environment.apiUrl}/tmdb`,
            params: cloneParams,
            headers: req.headers
                .set('X-TMDB-Path', targetPath)
                .set('X-Cinescope-Client', CINESCOPE_CLIENT_HEADER)
        });

        if (req.method === 'GET') {
            const queryString = cloneParams.toString();
            const cacheKey = queryString ? `tmdb:${targetPath}?${queryString}` : `tmdb:${targetPath}`;
            if (apiCache.isStaticEntityDetailEndpoint(targetPath)) {
                return apiCache.observeSessionDetailGet(
                    cacheKey,
                    CACHE_TTL.ENTITY_DETAILS_SESSION,
                    () => next(clonedRequest)
                );
            }
            return apiCache.observeNetworkFirstGet(cacheKey, () => next(clonedRequest));
        }

        return next(clonedRequest);
    }

    if (req.url.includes(environment.apiUrl)) {
        const clonedRequest = req.clone({
            headers: req.headers.set('X-Cinescope-Client', CINESCOPE_CLIENT_HEADER)
        });

        if (req.method === 'GET' && req.url.includes('/feed')) {
            const cacheKey = `feed:${req.urlWithParams}`;
            return apiCache.observeNetworkFirstGet(cacheKey, () => next(clonedRequest));
        }

        return next(clonedRequest);
    }

    return next(req);
};