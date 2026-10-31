import { Injectable, signal, computed, inject } from '@angular/core';
import { ToastService } from './toast.service';

export type DiscoverLanguageCode =
  | 'hi'
  | 'en'
  | 'pa'
  | 'mr'
  | 'bn'
  | 'gu'
  | 'te'
  | 'ta'
  | 'ml'
  | 'kn'
  | 'ko'
  | 'ja'
  | 'de'
  | 'es'
  | 'fr';

export interface DiscoverLanguageOption {
  code: DiscoverLanguageCode;
  label: string;
  nativeLabel: string;
  badge: string;
  group: 'indian' | 'global';
  originCountry: string;
}

export const DISCOVER_LANGUAGE_OPTIONS: readonly DiscoverLanguageOption[] = [
  // Indian Languages
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', badge: 'Bollywood & Hindi OTT', group: 'indian', originCountry: 'IN' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', badge: 'Pollywood', group: 'indian', originCountry: 'IN' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', badge: 'Marathi Cinema', group: 'indian', originCountry: 'IN' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', badge: 'Bengali Cinema', group: 'indian', originCountry: 'IN' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', badge: 'Dhollywood', group: 'indian', originCountry: 'IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', badge: 'Tollywood', group: 'indian', originCountry: 'IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', badge: 'Kollywood', group: 'indian', originCountry: 'IN' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', badge: 'Mollywood', group: 'indian', originCountry: 'IN' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', badge: 'Sandalwood', group: 'indian', originCountry: 'IN' },
  // Global Languages
  { code: 'en', label: 'English', nativeLabel: 'English', badge: 'Hollywood & Global', group: 'global', originCountry: 'US' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', badge: 'K-Drama & Thrillers', group: 'global', originCountry: 'KR' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', badge: 'Anime & J-Cinema', group: 'global', originCountry: 'JP' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', badge: 'DACH Cinema & Series', group: 'global', originCountry: 'DE' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', badge: 'Spanish & LatAm', group: 'global', originCountry: 'ES' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', badge: 'French Cinema', group: 'global', originCountry: 'FR' }
];

export type DiscoverGenreKey =
  | 'action'
  | 'thriller'
  | 'scifi'
  | 'comedy'
  | 'horror'
  | 'romance'
  | 'drama'
  | 'documentary';

export interface DiscoverGenreOption {
  key: DiscoverGenreKey;
  label: string;
  icon: string;
  movieGenreIds: string;
  tvGenreIds: string;
}

export const DISCOVER_GENRE_OPTIONS: readonly DiscoverGenreOption[] = [
  { key: 'action', label: 'Action', icon: 'flash-outline', movieGenreIds: '28|12', tvGenreIds: '10759' },
  { key: 'thriller', label: 'Thriller & Crime', icon: 'eye-outline', movieGenreIds: '53|80', tvGenreIds: '80|9648' },
  { key: 'scifi', label: 'Sci-Fi & Mystery', icon: 'planet-outline', movieGenreIds: '878|9648', tvGenreIds: '10765|9648' },
  { key: 'comedy', label: 'Comedy', icon: 'happy-outline', movieGenreIds: '35', tvGenreIds: '35' },
  { key: 'horror', label: 'Horror', icon: 'skull-outline', movieGenreIds: '27', tvGenreIds: '9648|10765' },
  { key: 'romance', label: 'Romance', icon: 'heart-outline', movieGenreIds: '10749', tvGenreIds: '10749' },
  { key: 'drama', label: 'Drama', icon: 'film-outline', movieGenreIds: '18|36', tvGenreIds: '18' },
  { key: 'documentary', label: 'Documentary', icon: 'videocam-outline', movieGenreIds: '99', tvGenreIds: '99' }
];

export type DiscoverTabId =
  | 'for-you'
  | 'trending'
  | 'bollywood'
  | 'desi-hub'
  | 'ott-streaming'
  | 'top-rated'
  | 'actors'
  | 'news';

export interface DiscoverTabVisibility {
  'for-you': boolean;
  trending: boolean;
  bollywood: boolean;
  'desi-hub': boolean;
  'ott-streaming': boolean;
  'top-rated': boolean;
  actors: boolean;
  news: boolean;
}

export interface DiscoverTabMeta {
  value: DiscoverTabId;
  label: string;
  settingsTitle: string;
  settingsSubtitle: string;
  icon: string;
}

export const DISCOVER_TABS_CATALOG: readonly DiscoverTabMeta[] = [
  {
    value: 'for-you',
    label: 'FOR YOU',
    settingsTitle: 'For You (Personalized)',
    settingsSubtitle: 'Recommendations based on your library, languages & favorite genres',
    icon: 'sparkles-outline'
  },
  {
    value: 'trending',
    label: 'TRENDING',
    settingsTitle: 'Trending & In Theaters',
    settingsSubtitle: 'Viral movies, theatrical releases & airing TV shows',
    icon: 'flame-outline'
  },
  {
    value: 'bollywood',
    label: 'BOLLYWOOD',
    settingsTitle: 'Bollywood & Hindi Hub',
    settingsSubtitle: 'Hindi theatrical releases, crime thrillers, OTT series & nostalgia',
    icon: 'film-outline'
  },
  {
    value: 'desi-hub',
    label: 'LANGUAGE HUB',
    settingsTitle: 'Regional & World Hub',
    settingsSubtitle: 'Dynamically populated only with the languages you select above',
    icon: 'globe-outline'
  },
  {
    value: 'ott-streaming',
    label: 'STREAMING',
    settingsTitle: 'OTT & Streaming Platforms',
    settingsSubtitle: 'Netflix, Prime Video, JioHotstar, SonyLIV & ZEE5 spotlights',
    icon: 'tv-outline'
  },
  {
    value: 'top-rated',
    label: 'TOP RATED',
    settingsTitle: 'Critics & Hall of Fame',
    settingsSubtitle: 'Modern masterpieces, all-time movies & prestige television',
    icon: 'trophy-outline'
  },
  {
    value: 'actors',
    label: 'ACTORS',
    settingsTitle: 'Star Spotlight & Filmographies',
    settingsSubtitle: 'Trending stars, global icons & breakout fan favorites',
    icon: 'people-outline'
  },
  {
    value: 'news',
    label: 'NEWS',
    settingsTitle: 'Entertainment News Feed',
    settingsSubtitle: 'Live curated entertainment & box-office stories',
    icon: 'newspaper-outline'
  }
];

export interface DiscoverPreferencesState {
  preferredLanguages: DiscoverLanguageCode[];
  favoriteGenres: DiscoverGenreKey[];
  tabVisibility: DiscoverTabVisibility;
  hideWatchedInDiscover: boolean;
}

export const DEFAULT_DISCOVER_TAB_VISIBILITY: DiscoverTabVisibility = {
  'for-you': true,
  trending: true,
  bollywood: true,
  'desi-hub': true,
  'ott-streaming': true,
  'top-rated': true,
  actors: true,
  news: true
};

export const DEFAULT_DISCOVER_PREFERENCES: DiscoverPreferencesState = {
  preferredLanguages: ['hi', 'en'],
  favoriteGenres: ['action', 'thriller', 'scifi'],
  tabVisibility: { ...DEFAULT_DISCOVER_TAB_VISIBILITY },
  hideWatchedInDiscover: true
};

const STORAGE_KEY_DISCOVER_PREFS = 'cinescope_discover_preferences';

@Injectable({
  providedIn: 'root'
})
export class DiscoverPreferencesService {
  private toast = inject(ToastService);

  public readonly state = signal<DiscoverPreferencesState>(this.loadStoredPreferences());

  public readonly preferredLanguages = computed<DiscoverLanguageCode[]>(() => this.state().preferredLanguages);
  public readonly favoriteGenres = computed<DiscoverGenreKey[]>(() => this.state().favoriteGenres);
  public readonly tabVisibility = computed<DiscoverTabVisibility>(() => this.state().tabVisibility);
  public readonly hideWatchedInDiscover = computed<boolean>(() => this.state().hideWatchedInDiscover);

  public readonly indianLanguageOptions = DISCOVER_LANGUAGE_OPTIONS.filter((l) => l.group === 'indian');
  public readonly globalLanguageOptions = DISCOVER_LANGUAGE_OPTIONS.filter((l) => l.group === 'global');
  public readonly genreOptions = DISCOVER_GENRE_OPTIONS;
  public readonly tabsCatalog = DISCOVER_TABS_CATALOG;

  public readonly selectedLanguageOptions = computed<DiscoverLanguageOption[]>(() => {
    const codes = new Set(this.preferredLanguages());
    return DISCOVER_LANGUAGE_OPTIONS.filter((opt) => codes.has(opt.code));
  });

  public readonly selectedGenreOptions = computed<DiscoverGenreOption[]>(() => {
    const keys = new Set(this.favoriteGenres());
    return DISCOVER_GENRE_OPTIONS.filter((opt) => keys.has(opt.key));
  });

  public readonly visibleTabs = computed<DiscoverTabMeta[]>(() => {
    const vis = this.tabVisibility();
    const filtered = DISCOVER_TABS_CATALOG.filter((tab) => vis[tab.value]);
    return filtered.length > 0 ? filtered : [DISCOVER_TABS_CATALOG[1]];
  });

  public readonly summarySubtitle = computed<string>(() => {
    const langs = this.selectedLanguageOptions()
      .slice(0, 3)
      .map((l) => l.label)
      .join(', ');
    const extraLangs = Math.max(0, this.preferredLanguages().length - 3);
    const langPart = extraLangs > 0 ? `${langs} +${extraLangs}` : langs;
    const genreCount = this.favoriteGenres().length;
    const visibleCount = this.visibleTabs().length;
    return `${langPart} • ${genreCount} ${genreCount === 1 ? 'genre' : 'genres'} • ${visibleCount} tabs`;
  });

  private loadStoredPreferences(): DiscoverPreferencesState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISCOVER_PREFS);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DiscoverPreferencesState>;
        const validLangCodes = new Set(DISCOVER_LANGUAGE_OPTIONS.map((l) => l.code));
        const validGenreKeys = new Set(DISCOVER_GENRE_OPTIONS.map((g) => g.key));

        const preferredLanguages = Array.isArray(parsed.preferredLanguages)
          ? parsed.preferredLanguages.filter((c): c is DiscoverLanguageCode => validLangCodes.has(c))
          : DEFAULT_DISCOVER_PREFERENCES.preferredLanguages;

        const favoriteGenres = Array.isArray(parsed.favoriteGenres)
          ? parsed.favoriteGenres.filter((k): k is DiscoverGenreKey => validGenreKeys.has(k))
          : DEFAULT_DISCOVER_PREFERENCES.favoriteGenres;

        const tabVisibility: DiscoverTabVisibility = {
          ...DEFAULT_DISCOVER_TAB_VISIBILITY,
          ...(parsed.tabVisibility || {})
        };

        return {
          preferredLanguages:
            preferredLanguages.length > 0
              ? preferredLanguages
              : [...DEFAULT_DISCOVER_PREFERENCES.preferredLanguages],
          favoriteGenres,
          tabVisibility,
          hideWatchedInDiscover:
            typeof parsed.hideWatchedInDiscover === 'boolean'
              ? parsed.hideWatchedInDiscover
              : DEFAULT_DISCOVER_PREFERENCES.hideWatchedInDiscover
        };
      }
    } catch {
      // Fallback to default on corrupt storage
    }
    return {
      preferredLanguages: [...DEFAULT_DISCOVER_PREFERENCES.preferredLanguages],
      favoriteGenres: [...DEFAULT_DISCOVER_PREFERENCES.favoriteGenres],
      tabVisibility: { ...DEFAULT_DISCOVER_TAB_VISIBILITY },
      hideWatchedInDiscover: DEFAULT_DISCOVER_PREFERENCES.hideWatchedInDiscover
    };
  }

  private persist(next: DiscoverPreferencesState): void {
    try {
      localStorage.setItem(STORAGE_KEY_DISCOVER_PREFS, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }

  public isLanguageSelected(code: DiscoverLanguageCode): boolean {
    return this.preferredLanguages().includes(code);
  }

  public async toggleLanguage(code: DiscoverLanguageCode): Promise<void> {
    const current = this.preferredLanguages();
    const exists = current.includes(code);
    if (exists && current.length <= 1) {
      await this.toast.presentInfo('Keep at least one language selected for Discover', 1800);
      return;
    }

    const updatedLangs = exists ? current.filter((c) => c !== code) : [...current, code];
    this.state.update((prev) => {
      const next: DiscoverPreferencesState = {
        ...prev,
        preferredLanguages: updatedLangs
      };
      this.persist(next);
      return next;
    });
  }

  public isGenreSelected(key: DiscoverGenreKey): boolean {
    return this.favoriteGenres().includes(key);
  }

  public toggleGenre(key: DiscoverGenreKey): void {
    const current = this.favoriteGenres();
    const exists = current.includes(key);
    const updatedGenres = exists ? current.filter((k) => k !== key) : [...current, key];

    this.state.update((prev) => {
      const next: DiscoverPreferencesState = {
        ...prev,
        favoriteGenres: updatedGenres
      };
      this.persist(next);
      return next;
    });
  }

  public async toggleTabVisibility(tabId: DiscoverTabId): Promise<void> {
    const currentVis = this.tabVisibility();
    const nextVal = !currentVis[tabId];

    // Prevent hiding all tabs
    if (!nextVal) {
      const remainingVisible = Object.entries(currentVis).filter(
        ([k, v]) => k !== tabId && v === true
      ).length;
      if (remainingVisible === 0) {
        await this.toast.presentInfo('At least one Discover tab must remain visible', 1800);
        return;
      }
    }

    this.state.update((prev) => {
      const next: DiscoverPreferencesState = {
        ...prev,
        tabVisibility: {
          ...prev.tabVisibility,
          [tabId]: nextVal
        }
      };
      this.persist(next);
      return next;
    });
  }

  public toggleHideWatched(): void {
    this.state.update((prev) => {
      const next: DiscoverPreferencesState = {
        ...prev,
        hideWatchedInDiscover: !prev.hideWatchedInDiscover
      };
      this.persist(next);
      return next;
    });
  }

  public async resetToDefault(): Promise<void> {
    const defaults: DiscoverPreferencesState = {
      preferredLanguages: [...DEFAULT_DISCOVER_PREFERENCES.preferredLanguages],
      favoriteGenres: [...DEFAULT_DISCOVER_PREFERENCES.favoriteGenres],
      tabVisibility: { ...DEFAULT_DISCOVER_TAB_VISIBILITY },
      hideWatchedInDiscover: DEFAULT_DISCOVER_PREFERENCES.hideWatchedInDiscover
    };
    this.state.set(defaults);
    this.persist(defaults);
    await this.toast.presentSuccess('Restored default Discover & Taste preferences', 2000);
  }
}
