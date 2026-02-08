import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { StorageService } from 'src/services/storage.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const storageService = inject(StorageService);

    // Only intercept requests to the TMDB API
    if (req.url.includes('api.themoviedb.org')) {
        return from(storageService.getSettings()).pipe(
            switchMap(settings => {
                let cloneParams = req.params;
                let cloneHeaders = req.headers;

                if (settings) {
                    if (settings.tmdbApiKey) {
                        cloneHeaders = cloneHeaders.set('Authorization', `Bearer ${settings.tmdbApiKey}`);
                    }

                    if ((req.url.includes('search') || req.url.includes('discover')) && settings.allowAdultContent !== undefined) {
                        cloneParams = cloneParams.set('include_adult', settings.allowAdultContent.toString());
                    }
                }

                const clonedRequest = req.clone({
                    headers: cloneHeaders,
                    params: cloneParams
                });

                return next(clonedRequest);
            })
        );
    }

    return next(req);
};
