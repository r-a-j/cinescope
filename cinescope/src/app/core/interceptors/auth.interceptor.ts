import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, Observable } from 'rxjs';
import { StorageService } from '../services/storage.service';
import { environment } from '../../../environments/environment';
import { MEDIA_API_PREFIX } from '../constants/api.constants';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
    const storageService = inject(StorageService);

    if (req.url.startsWith(MEDIA_API_PREFIX)) {
        return from(storageService.getSettings()).pipe(
            switchMap((settings: Record<string, unknown> | null): Observable<HttpEvent<unknown>> => {
                let cloneParams = req.params;

                const targetPath = req.url.replace(MEDIA_API_PREFIX, '');

                if ((targetPath.includes('search') || targetPath.includes('discover')) && settings?.['allowAdultContent'] !== undefined) {
                    cloneParams = cloneParams.set('include_adult', String(settings['allowAdultContent']));
                }

                const clonedRequest = req.clone({
                    url: `${environment.apiUrl}/tmdb`,
                    params: cloneParams,
                    headers: req.headers
                        .set('X-TMDB-Path', targetPath)
                        .set('X-Cinescope-Client', 'CS-Mobile-App-2026')
                });

                return next(clonedRequest);
            })
        );
    }

    if (req.url.includes(environment.apiUrl)) {
        const clonedRequest = req.clone({
            headers: req.headers.set('X-Cinescope-Client', 'CS-Mobile-App-2026')
        });
        return next(clonedRequest);
    }

    return next(req);
};