import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { authInterceptor } from './auth.interceptor';
import { StorageService } from '../services/storage.service';
import { ApiCacheService } from '../services/api-cache.service';
import { environment } from '../../../environments/environment';
import { CINESCOPE_CLIENT_HEADER, MEDIA_API_PREFIX } from '../constants/api.constants';

describe('authInterceptor', () => {
    let httpClient: HttpClient;
    let httpTestingController: HttpTestingController;
    const mockAllowAdult = signal<boolean>(false);

    beforeEach(() => {
        mockAllowAdult.set(false);

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authInterceptor])),
                provideHttpClientTesting(),
                {
                    provide: StorageService,
                    useValue: {
                        allowAdultContent: mockAllowAdult
                    }
                },
                {
                    provide: ApiCacheService,
                    useValue: {
                        isStaticEntityDetailEndpoint: (): boolean => false,
                        observeNetworkFirstGet: (_key: string, fn: () => unknown): unknown => fn(),
                        observeSessionDetailGet: (_key: string, _ttl: number, fn: () => unknown): unknown => fn()
                    }
                }
            ]
        });

        httpClient = TestBed.inject(HttpClient);
        httpTestingController = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpTestingController.verify();
    });

    it('rewrites media-data requests to the TMDB proxy with path header and query parameter', () => {
        httpClient.get(`${MEDIA_API_PREFIX}/movie/550`, { params: { language: 'en-US' } }).subscribe();

        const req = httpTestingController.expectOne((r) => r.url === `${environment.apiUrl}/tmdb`);
        expect(req.request.method).toBe('GET');
        expect(req.request.headers.get('X-TMDB-Path')).toBe('/movie/550');
        expect(req.request.headers.get('X-Cinescope-Client')).toBe(CINESCOPE_CLIENT_HEADER);
        expect(req.request.params.get('path')).toBe('/movie/550');
        expect(req.request.params.get('language')).toBe('en-US');

        req.flush({ id: 550, title: 'Fight Club' });
    });

    it('injects include_adult parameter for search and discover endpoints', () => {
        mockAllowAdult.set(true);

        httpClient.get(`${MEDIA_API_PREFIX}/discover/movie`).subscribe();

        const req = httpTestingController.expectOne((r) => r.url === `${environment.apiUrl}/tmdb`);
        expect(req.request.params.get('include_adult')).toBe('true');
        expect(req.request.params.get('path')).toBe('/discover/movie');

        req.flush({ results: [] });
    });

    it('blocks invalid TMDB paths with undefined or null ID without hitting the network', (done) => {
        httpClient.get(`${MEDIA_API_PREFIX}/movie/undefined`).subscribe({
            next: () => fail('Should have failed with 400 Bad Request'),
            error: (err) => {
                expect(err.status).toBe(400);
                expect(err.error?.error).toBe('Invalid TMDB target path');
                done();
            }
        });

        httpTestingController.expectNone(`${environment.apiUrl}/tmdb`);
    });

    it('blocks invalid TMDB paths with 0 ID without hitting the network', (done) => {
        httpClient.get(`${MEDIA_API_PREFIX}/tv/0`).subscribe({
            next: () => fail('Should have failed with 400 Bad Request'),
            error: (err) => {
                expect(err.status).toBe(400);
                expect(err.error?.error).toBe('Invalid TMDB target path');
                done();
            }
        });

        httpTestingController.expectNone(`${environment.apiUrl}/tmdb`);
    });

    it('attaches X-Cinescope-Client to environment API requests', () => {
        httpClient.get(`${environment.apiUrl}/feed`).subscribe();

        const req = httpTestingController.expectOne(`${environment.apiUrl}/feed`);
        expect(req.request.headers.get('X-Cinescope-Client')).toBe(CINESCOPE_CLIENT_HEADER);

        req.flush({ success: true });
    });

    it('passes external requests through unchanged', () => {
        httpClient.get('https://example.com/api/data').subscribe();

        const req = httpTestingController.expectOne('https://example.com/api/data');
        expect(req.request.headers.has('X-Cinescope-Client')).toBeFalse();
        expect(req.request.headers.has('X-TMDB-Path')).toBeFalse();

        req.flush({ ok: true });
    });
});
