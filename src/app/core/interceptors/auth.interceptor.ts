import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { StorageService } from 'src/services/storage.service';
import { environment } from 'src/environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const storageService = inject(StorageService);

    if (req.url.includes('api.themoviedb.org')) {
        return from(storageService.getSettings()).pipe(
            switchMap(settings => {
                let cloneParams = req.params;

                const tmdbUrl = new URL(req.url);
                const tmdbPath = tmdbUrl.pathname.replace('/3', '');

                if ((req.url.includes('search') || req.url.includes('discover')) && settings?.allowAdultContent !== undefined) {
                    cloneParams = cloneParams.set('include_adult', settings.allowAdultContent.toString());
                }

                const clonedRequest = req.clone({
                    url: `${environment.apiUrl}/tmdb`,
                    params: cloneParams,
                    headers: req.headers
                        .set('X-TMDB-Path', tmdbPath)
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