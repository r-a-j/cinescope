import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
    TvReleaseIntelService,
    TV_RELEASE_INTEL_CACHE_KEY,
    TWELVE_HOURS_MS,
    TvReleaseIntelResponseDto
} from './tv-release-intel.service';
import { environment } from '../../../environments/environment';

describe('TvReleaseIntelService', () => {
    let service: TvReleaseIntelService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        localStorage.removeItem(TV_RELEASE_INTEL_CACHE_KEY);

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                TvReleaseIntelService
            ]
        });

        service = TestBed.inject(TvReleaseIntelService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
        localStorage.removeItem(TV_RELEASE_INTEL_CACHE_KEY);
    });

    it('should be created and initialize with empty map when no storage exists', () => {
        expect(service).toBeTruthy();
        expect(service.intelMap().size).toBe(0);
    });

    it('should hydrate from storage if valid cache exists on startup', () => {
        const fakeCache = {
            lastCheckedAt: Date.now() - 1000,
            items: {
                555: {
                    tmdbId: 555,
                    seriesTitle: 'Matka King',
                    seasonNumber: 2,
                    releaseStatus: 'planned' as const,
                    releaseDate: null,
                    releaseYear: 2026,
                    releaseWindow: 'Late 2026',
                    confidence: 'medium' as const,
                    notes: 'Announced by Prime Video',
                    verifiedAt: Date.now() - 1000
                }
            }
        };
        localStorage.setItem(TV_RELEASE_INTEL_CACHE_KEY, JSON.stringify(fakeCache));

        // Re-create service in injection context to test startup hydration
        const freshService = TestBed.runInInjectionContext(() => new TvReleaseIntelService());
        expect(freshService.intelMap().size).toBe(1);
        const item = freshService.getIntelForSeries(555);
        expect(item).toBeDefined();
        expect(item?.releaseYear).toBe(2026);
        expect(item?.releaseWindow).toBe('Late 2026');
    });

    it('should identify cache expiration correctly based on 12-hour threshold', () => {
        expect(service.isCacheExpired()).toBeTrue();
        expect(service.isCacheExpired(Date.now() - 1000)).toBeFalse(); // 1 second ago -> fresh
        expect(service.isCacheExpired(Date.now() - (TWELVE_HOURS_MS - 10000))).toBeFalse(); // 11h 59m ago -> fresh
        expect(service.isCacheExpired(Date.now() - (TWELVE_HOURS_MS + 1000))).toBeTrue(); // 12h 1s ago -> expired
    });

    it('should serve from cache without making HTTP call when 12-hour cache is still valid', async () => {
        const fakeCache = {
            lastCheckedAt: Date.now() - 3600000, // 1 hour ago
            items: {
                555: {
                    tmdbId: 555,
                    seriesTitle: 'Matka King',
                    seasonNumber: 2,
                    releaseStatus: 'planned' as const,
                    releaseDate: null,
                    releaseYear: 2026,
                    releaseWindow: 'Late 2026',
                    confidence: 'medium' as const,
                    notes: 'Cached',
                    verifiedAt: Date.now() - 3600000
                }
            }
        };
        localStorage.setItem(TV_RELEASE_INTEL_CACHE_KEY, JSON.stringify(fakeCache));

        const result = await service.verifyReleaseDates([
            { tmdbId: 555, title: 'Matka King', seasonNumber: 2 }
        ]);

        // No HTTP request should have been made
        httpMock.expectNone(`${environment.apiUrl}/tv-release-intel`);
        expect(result.size).toBe(1);
        expect(result.get(555)?.releaseYear).toBe(2026);
    });

    it('should query Gemini BFF and update cache when 12 hours have elapsed', async () => {
        const candidates = [
            { tmdbId: 555, title: 'Matka King', seasonNumber: 2, currentAirDate: null },
            { tmdbId: 101, title: 'Severance', seasonNumber: 2, currentAirDate: '2027-01-15' }
        ];

        const promise = service.verifyReleaseDates(candidates, true);

        const req = httpMock.expectOne(`${environment.apiUrl}/tv-release-intel`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body.series.length).toBe(2);

        const mockResponse: TvReleaseIntelResponseDto = {
            results: [
                {
                    tmdbId: 555,
                    seriesTitle: 'Matka King',
                    seasonNumber: 2,
                    releaseStatus: 'planned',
                    releaseDate: null,
                    releaseYear: 2026,
                    releaseWindow: 'Late 2026',
                    confidence: 'medium',
                    notes: 'Targeting late 2026'
                },
                {
                    tmdbId: 101,
                    seriesTitle: 'Severance',
                    seasonNumber: 2,
                    releaseStatus: 'confirmed',
                    releaseDate: '2026-11-20',
                    releaseYear: 2026,
                    releaseWindow: 'Nov 2026',
                    confidence: 'high',
                    notes: 'Officially scheduled by Apple TV+'
                }
            ]
        };

        req.flush(mockResponse);

        const result = await promise;
        expect(result.size).toBe(2);

        const matka = result.get(555);
        expect(matka?.releaseYear).toBe(2026);
        expect(matka?.releaseStatus).toBe('planned');

        const severance = result.get(101);
        expect(severance?.releaseDate).toBe('2026-11-20');
        expect(severance?.releaseStatus).toBe('confirmed');

        // Verify storage cache updated with fresh timestamp
        const stored = service.readStorageCache();
        expect(stored).not.toBeNull();
        expect(stored?.items[101].releaseDate).toBe('2026-11-20');
        expect(service.isCacheExpired(stored?.lastCheckedAt)).toBeFalse();
    });

    it('should gracefully retain existing cache if HTTP call fails or device is offline', async () => {
        const fakeCache = {
            lastCheckedAt: Date.now() - (TWELVE_HOURS_MS + 5000), // Expired
            items: {
                555: {
                    tmdbId: 555,
                    seriesTitle: 'Matka King',
                    seasonNumber: 2,
                    releaseStatus: 'planned' as const,
                    releaseDate: null,
                    releaseYear: 2026,
                    releaseWindow: 'Late 2026',
                    confidence: 'medium' as const,
                    notes: 'Cached fallback',
                    verifiedAt: Date.now() - (TWELVE_HOURS_MS + 5000)
                }
            }
        };
        localStorage.setItem(TV_RELEASE_INTEL_CACHE_KEY, JSON.stringify(fakeCache));

        const promise = service.verifyReleaseDates([
            { tmdbId: 555, title: 'Matka King', seasonNumber: 2 }
        ], true);

        const req = httpMock.expectOne(`${environment.apiUrl}/tv-release-intel`);
        req.error(new ProgressEvent('Network error'));

        const result = await promise;
        expect(result.size).toBe(1);
        expect(result.get(555)?.notes).toBe('Cached fallback');
    });
});
