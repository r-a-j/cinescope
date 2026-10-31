import { TestBed } from '@angular/core/testing';
import { DiscoverPreferencesService } from './discover-preferences.service';
import { ToastService } from './toast.service';

describe('DiscoverPreferencesService', () => {
  let service: DiscoverPreferencesService;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    localStorage.removeItem('cinescope_discover_preferences');
    toastSpy = jasmine.createSpyObj('ToastService', ['presentInfo', 'presentSuccess']);
    toastSpy.presentInfo.and.resolveTo();
    toastSpy.presentSuccess.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        DiscoverPreferencesService,
        { provide: ToastService, useValue: toastSpy }
      ]
    });
    service = TestBed.inject(DiscoverPreferencesService);
  });

  afterEach(() => {
    localStorage.removeItem('cinescope_discover_preferences');
  });

  it('initializes with Hindi & English as default preferred languages', () => {
    expect(service.preferredLanguages()).toEqual(['hi', 'en']);
    expect(service.hideWatchedInDiscover()).toBeTrue();
    expect(service.visibleTabs().length).toBe(8);
  });

  it('toggles languages and prevents deselecting the last remaining language', async () => {
    await service.toggleLanguage('ko');
    expect(service.isLanguageSelected('ko')).toBeTrue();

    await service.toggleLanguage('hi');
    await service.toggleLanguage('en');
    // Only 'ko' remains; attempting to remove 'ko' should keep it selected and show toast
    await service.toggleLanguage('ko');
    expect(service.preferredLanguages()).toEqual(['ko']);
    expect(toastSpy.presentInfo).toHaveBeenCalled();
  });

  it('toggles favorite genres, cinema vibes, and caches 12h AI taste lanes', () => {
    expect(service.isGenreSelected('comedy')).toBeFalse();
    service.toggleGenre('comedy');
    expect(service.isGenreSelected('comedy')).toBeTrue();

    expect(service.isVibeSelected('hidden-gems')).toBeFalse();
    service.toggleVibe('hidden-gems');
    expect(service.isVibeSelected('hidden-gems')).toBeTrue();

    service.saveAiTasteCache(
      [
        {
          id: 'ai-test-1',
          title: 'AI CURATED: NEO-NOIR THRILLERS',
          mediaType: 'movie',
          movieParams: { with_genres: '53', sort_by: 'popularity.desc' }
        }
      ],
      'fan of Inception'
    );
    const cached = service.getValidAiTasteCache();
    expect(cached).not.toBeNull();
    expect(cached?.lanes.length).toBe(1);
    service.clearAiTasteCache();
  });

  it('toggles tab visibility and resets to defaults', async () => {
    await service.toggleTabVisibility('news');
    expect(service.tabVisibility().news).toBeFalse();

    await service.resetToDefault();
    expect(service.tabVisibility().news).toBeTrue();
    expect(service.preferredLanguages()).toEqual(['hi', 'en']);
  });
});
