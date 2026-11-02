import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
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

        // Guard against invalid or malformed TMDB paths (e.g. /movie/undefined, /tv/null, /movie/NaN, /0, or empty paths)
        if (
            !targetPath ||
            targetPath === '/' ||
            /(?:^|\/)(?:undefined|null|NaN)(?:\/|$)/i.test(targetPath) ||
            /^\/(?:movie|tv|person|collection|company|network)\/(?:0|\D+)(?:\/|$)/.test(targetPath)
        ) {
            console.warn(`[AuthInterceptor] Blocked network request for invalid TMDB path: "${targetPath}"`);
            return throwError(
                () =>
                    new HttpErrorResponse({
                        status: 400,
                        statusText: 'Bad Request',
                        url: req.url,
                        error: { error: 'Invalid TMDB target path', path: targetPath }
                    })
            );
        }

        if (targetPath.includes('search') || targetPath.includes('discover')) {
            cloneParams = cloneParams.set('include_adult', String(storageService.allowAdultContent()));
        }

        // Attach path query parameter for transparent debugging in network logs & browser console
        cloneParams = cloneParams.set('path', targetPath);

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