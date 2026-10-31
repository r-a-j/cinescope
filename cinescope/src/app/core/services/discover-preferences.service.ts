import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ToastService } from './toast.service';
import { TmdbConfigurationService } from './tmdb-configuration.service';
import { TmdbGenresService } from './tmdb-genres.service';
import { TmdbLanguageDto } from '../dtos/configuration/language.dto';
import { TmdbDiscoverMovieParamsDto } from '../dtos/discover/discover-movie-params.dto';
import { TmdbDiscoverTvParamsDto } from '../dtos/discover/discover-tv-params.dto';

export type DiscoverLanguageCode = string;

export interface DiscoverLanguageOption {
  code: DiscoverLanguageCode;
  label: string;
  nativeLabel: string;
  badge: string;
  group: 'indian' | 'global';
  originCountry: string;
}

export const INDIAN_ISO_CODES = new Set<string>([
  'hi',
  'pa',
  'mr',
  'bn',
  'gu',
  'te',
  'ta',
  'ml',
  'kn',
  'ur',
  'or',
  'as',
  'ne',
  'sa',
  'sd',
  'ks',
  'kok',
  'mai',
  'bho'
]);

/**
 * Verified mapping of ISO 639-1 cinema language codes to their primary ISO 3166-1 country code.
 * Never falls back to 'US' for unrelated languages, and filters out dead/constructed ISO codes
 * (e.g., Esperanto, Volapük, Church Slavic, Avestan) that have no active cinema catalog on TMDB.
 */
export const ISO_639_1_TO_COUNTRY_MAP: Readonly<Record<string, string>> = {
  // Indian & South Asian Cinema Languages
  hi: 'IN',
  pa: 'IN',
  mr: 'IN',
  bn: 'IN',
  gu: 'IN',
  te: 'IN',
  ta: 'IN',
  ml: 'IN',
  kn: 'IN',
  or: 'IN',
  as: 'IN',
  sa: 'IN',
  sd: 'IN',
  ks: 'IN',
  ur: 'PK',
  ne: 'NP',
  si: 'LK',
  // East & Southeast Asian Cinema Languages
  ko: 'KR',
  ja: 'JP',
  zh: 'CN',
  cn: 'HK',
  th: 'TH',
  id: 'ID',
  ms: 'MY',
  vi: 'VN',
  tl: 'PH',
  my: 'MM',
  km: 'KH',
  lo: 'LA',
  mn: 'MN',
  bo: 'CN',
  dz: 'BT',
  // European & Nordic Cinema Languages
  en: 'US',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  pt: 'BR',
  ru: 'RU',
  pl: 'PL',
  sv: 'SE',
  da: 'DK',
  no: 'NO',
  nb: 'NO',
  nn: 'NO',
  fi: 'FI',
  is: 'IS',
  nl: 'NL',
  el: 'GR',
  cs: 'CZ',
  sk: 'SK',
  hu: 'HU',
  ro: 'RO',
  bg: 'BG',
  uk: 'UA',
  sr: 'RS',
  hr: 'HR',
  sl: 'SI',
  bs: 'BA',
  mk: 'MK',
  sq: 'AL',
  et: 'EE',
  lv: 'LV',
  lt: 'LT',
  ga: 'IE',
  cy: 'GB',
  gd: 'GB',
  ca: 'ES',
  eu: 'ES',
  gl: 'ES',
  mt: 'MT',
  lb: 'LU',
  be: 'BY',
  // Middle Eastern, Central Asian & African Cinema Languages
  tr: 'TR',
  ar: 'EG',
  fa: 'IR',
  he: 'IL',
  ka: 'GE',
  hy: 'AM',
  az: 'AZ',
  kk: 'KZ',
  uz: 'UZ',
  ps: 'AF',
  tg: 'TJ',
  ky: 'KG',
  tk: 'TM',
  af: 'ZA',
  zu: 'ZA',
  xh: 'ZA',
  sw: 'KE',
  am: 'ET',
  yo: 'NG',
  ig: 'NG',
  ha: 'NG',
  so: 'SO',
  rw: 'RW',
  wo: 'SN'
};

export const GLOBAL_PRIORITY_CODES: readonly string[] = [
  'en',
  'ko',
  'ja',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'zh',
  'cn',
  'ru',
  'tr',
  'th',
  'id',
  'ar',
  'fa',
  'pl',
  'sv',
  'da',
  'no',
  'nl',
  'el',
  'he',
  'vi',
  'tl',
  'fi',
  'cs',
  'hu',
  'ro',
  'uk'
];

export const DISCOVER_LANGUAGE_OPTIONS: readonly DiscoverLanguageOption[] = [
  // Core Indian Languages
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', badge: 'Bollywood & Hindi OTT', group: 'indian', originCountry: 'IN' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', badge: 'Pollywood', group: 'indian', originCountry: 'IN' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', badge: 'Marathi Cinema', group: 'indian', originCountry: 'IN' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', badge: 'Bengali Cinema', group: 'indian', originCountry: 'IN' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', badge: 'Dhollywood', group: 'indian', originCountry: 'IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', badge: 'Tollywood', group: 'indian', originCountry: 'IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', badge: 'Kollywood', group: 'indian', originCountry: 'IN' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', badge: 'Mollywood', group: 'indian', originCountry: 'IN' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', badge: 'Sandalwood', group: 'indian', originCountry: 'IN' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', badge: 'Urdu Cinema & Drama', group: 'indian', originCountry: 'IN' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', badge: 'Ollywood', group: 'indian', originCountry: 'IN' },
  { code: 'as', label: 'Assamese', nativeLabel: 'অসমীয়া', badge: 'Jollywood', group: 'indian', originCountry: 'IN' },
  { code: 'ne', label: 'Nepali', nativeLabel: 'नेपाली', badge: 'Himalayan Cinema', group: 'indian', originCountry: 'NP' },
  // Core Global & International Languages
  { code: 'en', label: 'English', nativeLabel: 'English', badge: 'Hollywood & Global', group: 'global', originCountry: 'US' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', badge: 'K-Drama & Thrillers', group: 'global', originCountry: 'KR' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', badge: 'Anime & J-Cinema', group: 'global', originCountry: 'JP' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', badge: 'Spanish & LatAm', group: 'global', originCountry: 'ES' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', badge: 'French Cinema', group: 'global', originCountry: 'FR' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', badge: 'DACH Cinema & Series', group: 'global', originCountry: 'DE' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', badge: 'Italian Cinema', group: 'global', originCountry: 'IT' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', badge: 'Brazil & Portugal', group: 'global', originCountry: 'BR' },
  { code: 'zh', label: 'Chinese (Mandarin)', nativeLabel: '普通话', badge: 'Chinese Cinema & C-Drama', group: 'global', originCountry: 'CN' },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', badge: 'Turkish Series & Drama', group: 'global', originCountry: 'TR' },
  { code: 'th', label: 'Thai', nativeLabel: 'ภาษาไทย', badge: 'Thai Cinema & Series', group: 'global', originCountry: 'TH' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Pусский', badge: 'Russian Cinema', group: 'global', originCountry: 'RU' },
  { code: 'id', label: 'Indonesian', nativeLabel: 'Bahasa Indonesia', badge: 'Indonesian Action & Horror', group: 'global', originCountry: 'ID' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', badge: 'MENA Cinema', group: 'global', originCountry: 'EG' },
  { code: 'fa', label: 'Persian', nativeLabel: 'فارسی', badge: 'Iranian Masterpieces', group: 'global', originCountry: 'IR' },
  { code: 'pl', label: 'Polish', nativeLabel: 'Polski', badge: 'Polish Cinema', group: 'global', originCountry: 'PL' },
  { code: 'sv', label: 'Swedish', nativeLabel: 'Svenska', badge: 'Nordic Noir', group: 'global', originCountry: 'SE' },
  { code: 'da', label: 'Danish', nativeLabel: 'Dansk', badge: 'Danish Cinema', group: 'global', originCountry: 'DK' },
  { code: 'no', label: 'Norwegian', nativeLabel: 'Norsk', badge: 'Norwegian Cinema', group: 'global', originCountry: 'NO' }
];

export type DiscoverGenreKey =
  | 'action'
  | 'adventure'
  | 'animation'
  | 'comedy'
  | 'crime'
  | 'documentary'
  | 'drama'
  | 'family'
  | 'fantasy'
  | 'history'
  | 'horror'
  | 'music'
  | 'mystery'
  | 'romance'
  | 'scifi'
  | 'thriller'
  | 'war'
  | 'western';

export interface DiscoverGenreOption {
  key: DiscoverGenreKey;
  label: string;
  icon: string;
  movieGenreIds: string;
  tvGenreIds: string;
}

export const DISCOVER_GENRE_OPTIONS: readonly DiscoverGenreOption[] = [
  { key: 'action', label: 'Action', icon: 'flash-outline', movieGenreIds: '28', tvGenreIds: '10759' },
  { key: 'thriller', label: 'Thriller', icon: 'eye-outline', movieGenreIds: '53', tvGenreIds: '80|9648' },
  { key: 'scifi', label: 'Sci-Fi', icon: 'planet-outline', movieGenreIds: '878', tvGenreIds: '10765' },
  { key: 'crime', label: 'Crime', icon: 'finger-print-outline', movieGenreIds: '80', tvGenreIds: '80' },
  { key: 'mystery', label: 'Mystery', icon: 'help-buoy-outline', movieGenreIds: '9648', tvGenreIds: '9648' },
  { key: 'comedy', label: 'Comedy', icon: 'happy-outline', movieGenreIds: '35', tvGenreIds: '35' },
  { key: 'drama', label: 'Drama', icon: 'film-outline', movieGenreIds: '18', tvGenreIds: '18' },
  { key: 'romance', label: 'Romance', icon: 'heart-outline', movieGenreIds: '10749', tvGenreIds: '10749' },
  { key: 'horror', label: 'Horror', icon: 'skull-outline', movieGenreIds: '27', tvGenreIds: '9648|10765' },
  { key: 'adventure', label: 'Adventure', icon: 'compass-outline', movieGenreIds: '12', tvGenreIds: '10759' },
  { key: 'fantasy', label: 'Fantasy', icon: 'color-wand-outline', movieGenreIds: '14', tvGenreIds: '10765' },
  { key: 'animation', label: 'Animation', icon: 'sparkles-outline', movieGenreIds: '16', tvGenreIds: '16' },
  { key: 'documentary', label: 'Documentary', icon: 'videocam-outline', movieGenreIds: '99', tvGenreIds: '99' },
  { key: 'history', label: 'History & Biopic', icon: 'hourglass-outline', movieGenreIds: '36', tvGenreIds: '18|10768' },
  { key: 'family', label: 'Family', icon: 'people-outline', movieGenreIds: '10751', tvGenreIds: '10751' },
  { key: 'war', label: 'War & Politics', icon: 'shield-outline', movieGenreIds: '10752', tvGenreIds: '10768' },
  { key: 'music', label: 'Music', icon: 'musical-notes-outline', movieGenreIds: '10402', tvGenreIds: '10402' },
  { key: 'western', label: 'Western', icon: 'sunny-outline', movieGenreIds: '37', tvGenreIds: '37' }
];

export type DiscoverVibeKey =
  | 'mind-benders'
  | 'gritty-crime'
  | 'feel-good'
  | 'edge-thrillers'
  | 'epic-worlds'
  | 'true-stories'
  | 'quick-watch'
  | '90s-2000s-gold'
  | 'hidden-gems';

export interface DiscoverVibeOption {
  key: DiscoverVibeKey;
  label: string;
  subtitle: string;
  swimlaneTitle: string;
  movieParams: TmdbDiscoverMovieParamsDto;
  tvParams?: TmdbDiscoverTvParamsDto;
}

export const DISCOVER_VIBE_OPTIONS: readonly DiscoverVibeOption[] = [
  {
    key: 'mind-benders',
    label: 'Mind-Benders & Plot Twists',
    subtitle: 'High-rated mystery, sci-fi & psychological suspense',
    swimlaneTitle: 'MIND-BENDERS & PLOT TWISTS',
    movieParams: {
      with_genres: '9648|878|53',
      sort_by: 'vote_average.desc',
      'vote_average.gte': 7.2,
      'vote_count.gte': 150
    }
  },
  {
    key: 'gritty-crime',
    label: 'Dark Crime & Gritty Noir',
    subtitle: 'Underworld, detectives, heists & intense crime thrillers',
    swimlaneTitle: 'DARK CRIME & GRITTY NOIR',
    movieParams: {
      with_genres: '80,53',
      sort_by: 'popularity.desc',
      'vote_average.gte': 7.0,
      'vote_count.gte': 100
    }
  },
  {
    key: 'feel-good',
    label: 'Feel-Good & Comfort Watch',
    subtitle: 'Uplifting comedies, heartwarming stories & zero-stress cinema',
    swimlaneTitle: 'FEEL-GOOD & COMFORT WATCH',
    movieParams: {
      with_genres: '35|10751',
      without_genres: '27,53,80',
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.8,
      'vote_count.gte': 80
    }
  },
  {
    key: 'edge-thrillers',
    label: 'Edge-of-Seat Suspense',
    subtitle: 'Relentless pacing, survival & high-stakes tension',
    swimlaneTitle: 'EDGE-OF-SEAT SUSPENSE',
    movieParams: {
      with_genres: '53',
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.9,
      'vote_count.gte': 120
    }
  },
  {
    key: 'epic-worlds',
    label: 'Epic Worlds & Sci-Fi / Fantasy',
    subtitle: 'Immersive universes, space odysseys & mythic adventures',
    swimlaneTitle: 'EPIC WORLDS & SCI-FI / FANTASY',
    movieParams: {
      with_genres: '878|14|12',
      sort_by: 'popularity.desc',
      'vote_average.gte': 7.0,
      'vote_count.gte': 150
    }
  },
  {
    key: 'true-stories',
    label: 'True Stories, Biopics & History',
    subtitle: 'Acclaimed historical dramas & real-world documentaries',
    swimlaneTitle: 'TRUE STORIES, BIOPICS & HISTORY',
    movieParams: {
      with_genres: '36|99',
      sort_by: 'vote_average.desc',
      'vote_average.gte': 7.1,
      'vote_count.gte': 60
    }
  },
  {
    key: 'quick-watch',
    label: 'Quick Watch (< 100 Mins)',
    subtitle: 'Tight, high-rated movies under 1 hour 40 minutes',
    swimlaneTitle: 'QUICK WATCH TONIGHT (< 100 MINS)',
    movieParams: {
      'with_runtime.lte': 100,
      'with_runtime.gte': 65,
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.8,
      'vote_count.gte': 60
    }
  },
  {
    key: '90s-2000s-gold',
    label: '90s & 2000s Golden Nostalgia',
    subtitle: 'Iconic hits and cult classics from 1990–2009',
    swimlaneTitle: '90s & 2000s GOLDEN NOSTALGIA',
    movieParams: {
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '2009-12-31',
      sort_by: 'popularity.desc',
      'vote_average.gte': 7.1,
      'vote_count.gte': 100
    }
  },
  {
    key: 'hidden-gems',
    label: 'Underrated Hidden Gems',
    subtitle: 'Critics-loved sleeper hits (7.4+ rating, non-mainstream)',
    swimlaneTitle: 'UNDERRATED HIDDEN GEMS',
    movieParams: {
      sort_by: 'vote_average.desc',
      'vote_average.gte': 7.4,
      'vote_count.gte': 45,
      'vote_count.lte': 1800
    }
  }
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
    settingsSubtitle: 'AI & taste lanes from your library, languages, genres & vibes',
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
    settingsSubtitle: 'Dynamically populated for any Indian or Global language you select',
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

export interface AiTasteCachedLane {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  movieParams?: TmdbDiscoverMovieParamsDto;
  tvParams?: TmdbDiscoverTvParamsDto;
}

export interface AiTasteCachePayload {
  generatedAt: number;
  expiresAt: number;
  seedSummary: string;
  lanes: AiTasteCachedLane[];
}

export const AI_TASTE_TTL_MS = 12 * 60 * 60 * 1000; // Strictly 12 hours

export interface DiscoverPreferencesState {
  preferredLanguages: DiscoverLanguageCode[];
  favoriteGenres: DiscoverGenreKey[];
  favoriteVibes: DiscoverVibeKey[];
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
  favoriteVibes: ['mind-benders', 'gritty-crime'],
  tabVisibility: { ...DEFAULT_DISCOVER_TAB_VISIBILITY },
  hideWatchedInDiscover: true
};

const STORAGE_KEY_DISCOVER_PREFS = 'cinescope_discover_preferences';
const STORAGE_KEY_TMDB_LANGUAGES_LEGACY = 'cinescope_tmdb_languages_catalog_v1';
const STORAGE_KEY_TMDB_LANGUAGES = 'cinescope_tmdb_languages_catalog_v2';
const STORAGE_KEY_AI_TASTE_CACHE = 'cinescope_ai_taste_cache_v1';
const CATALOG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable({
  providedIn: 'root'
})
export class DiscoverPreferencesService {
  private toast = inject(ToastService);
  private tmdbConfig = inject(TmdbConfigurationService, { optional: true });
  private tmdbGenres = inject(TmdbGenresService, { optional: true });

  private catalogsHydrated = false;

  public readonly state = signal<DiscoverPreferencesState>(this.loadStoredPreferences());
  public readonly allAvailableLanguages = signal<DiscoverLanguageOption[]>(this.loadCachedLanguagesCatalog());
  public readonly isSyncingLanguages = signal<boolean>(false);
  public readonly aiTasteCache = signal<AiTasteCachePayload | null>(this.loadStoredAiTasteCache());

  public readonly preferredLanguages = computed<DiscoverLanguageCode[]>(() => this.state().preferredLanguages);
  public readonly favoriteGenres = computed<DiscoverGenreKey[]>(() => this.state().favoriteGenres);
  public readonly favoriteVibes = computed<DiscoverVibeKey[]>(() => this.state().favoriteVibes);
  public readonly tabVisibility = computed<DiscoverTabVisibility>(() => this.state().tabVisibility);
  public readonly hideWatchedInDiscover = computed<boolean>(() => this.state().hideWatchedInDiscover);

  public readonly genreOptions = DISCOVER_GENRE_OPTIONS;
  public readonly vibeOptions = DISCOVER_VIBE_OPTIONS;
  public readonly tabsCatalog = DISCOVER_TABS_CATALOG;

  public readonly indianLanguageOptions = computed<DiscoverLanguageOption[]>(() => {
    const selected = new Set(this.preferredLanguages());
    const coreOrder = new Map(DISCOVER_LANGUAGE_OPTIONS.map((l, idx) => [l.code, idx]));
    return this.allAvailableLanguages()
      .filter((l) => l.group === 'indian')
      .sort((a, b) => {
        const aSel = selected.has(a.code) ? 0 : 1;
        const bSel = selected.has(b.code) ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        const aCore = coreOrder.get(a.code) ?? 999;
        const bCore = coreOrder.get(b.code) ?? 999;
        if (aCore !== bCore) return aCore - bCore;
        return a.label.localeCompare(b.label);
      });
  });

  public readonly globalLanguageOptions = computed<DiscoverLanguageOption[]>(() => {
    const selected = new Set(this.preferredLanguages());
    const priorityOrder = new Map(GLOBAL_PRIORITY_CODES.map((c, idx) => [c, idx]));
    return this.allAvailableLanguages()
      .filter((l) => l.group === 'global')
      .sort((a, b) => {
        const aSel = selected.has(a.code) ? 0 : 1;
        const bSel = selected.has(b.code) ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        const aPri = priorityOrder.get(a.code) ?? 999;
        const bPri = priorityOrder.get(b.code) ?? 999;
        if (aPri !== bPri) return aPri - bPri;
        return a.label.localeCompare(b.label);
      });
  });

  public readonly selectedLanguageOptions = computed<DiscoverLanguageOption[]>(() => {
    const map = new Map(this.allAvailableLanguages().map((opt) => [opt.code, opt]));
    return this.preferredLanguages().map(
      (code) =>
        map.get(code) ?? {
          code,
          label: code.toUpperCase(),
          nativeLabel: code.toUpperCase(),
          badge: `${code.toUpperCase()} Cinema`,
          group: INDIAN_ISO_CODES.has(code) ? 'indian' : 'global',
          originCountry: ISO_639_1_TO_COUNTRY_MAP[code] || (INDIAN_ISO_CODES.has(code) ? 'IN' : '')
        }
    );
  });

  public readonly selectedGenreOptions = computed<DiscoverGenreOption[]>(() => {
    const keys = new Set(this.favoriteGenres());
    return DISCOVER_GENRE_OPTIONS.filter((opt) => keys.has(opt.key));
  });

  public readonly selectedVibeOptions = computed<DiscoverVibeOption[]>(() => {
    const keys = new Set(this.favoriteVibes());
    return DISCOVER_VIBE_OPTIONS.filter((opt) => keys.has(opt.key));
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
    const genreAndVibeCount = this.favoriteGenres().length + this.favoriteVibes().length;
    const visibleCount = this.visibleTabs().length;
    return `${langPart} • ${genreAndVibeCount} tastes • ${visibleCount} tabs`;
  });

  public readonly aiTasteStatusLabel = computed<string>(() => {
    const cache = this.aiTasteCache();
    if (!cache || cache.lanes.length === 0) {
      return 'Auto-curates every 12h from your Watched & Watchlist';
    }
    const now = Date.now();
    if (now >= cache.expiresAt) {
      return `Ready to refresh (${cache.lanes.length} AI lanes cached)`;
    }
    const hoursLeft = Math.max(1, Math.ceil((cache.expiresAt - now) / (60 * 60 * 1000)));
    return `${cache.lanes.length} AI lanes active • Refreshes in ~${hoursLeft}h`;
  });

  /**
   * Fetches all official TMDB languages (`/configuration/languages`) & genres (`/genre/movie/list`)
   * once and merges them into `allAvailableLanguages` with a 7-day localStorage cache.
   */
  public async ensureApiCatalogsLoaded(force = false): Promise<void> {
    if (this.catalogsHydrated && !force) {
      return;
    }
    this.catalogsHydrated = true;

    if (!this.tmdbConfig) {
      return;
    }

    if (!force) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TMDB_LANGUAGES);
        if (raw) {
          const parsed = JSON.parse(raw) as { timestamp?: number; items?: DiscoverLanguageOption[] };
          if (
            parsed.timestamp &&
            Date.now() - parsed.timestamp < CATALOG_CACHE_TTL_MS &&
            Array.isArray(parsed.items) &&
            parsed.items.length > 30
          ) {
            this.allAvailableLanguages.set(parsed.items);
            return;
          }
        }
      } catch {
        // Proceed to live fetch
      }
    }

    this.isSyncingLanguages.set(true);
    try {
      const tmdbLangs = await firstValueFrom(this.tmdbConfig.getLanguages());
      if (Array.isArray(tmdbLangs) && tmdbLangs.length > 0) {
        const merged = this.mergeTmdbLanguages(tmdbLangs);
        this.allAvailableLanguages.set(merged);
        try {
          localStorage.setItem(
            STORAGE_KEY_TMDB_LANGUAGES,
            JSON.stringify({ timestamp: Date.now(), items: merged })
          );
        } catch {
          // Ignore quota errors
        }
      }

      if (this.tmdbGenres) {
        // Warm official genres dictionary in parallel
        void firstValueFrom(this.tmdbGenres.getMovieGenres()).catch(() => null);
      }
    } catch {
      // Keep fallback DISCOVER_LANGUAGE_OPTIONS on network error
    } finally {
      this.isSyncingLanguages.set(false);
    }
  }

  private mergeTmdbLanguages(dtos: TmdbLanguageDto[]): DiscoverLanguageOption[] {
    const byCode = new Map<string, DiscoverLanguageOption>();
    for (const preset of DISCOVER_LANGUAGE_OPTIONS) {
      byCode.set(preset.code, preset);
    }

    for (const dto of dtos) {
      const code = (dto.iso_639_1 || '').trim().toLowerCase();
      const englishName = (dto.english_name || '').trim();
      const mappedCountry = ISO_639_1_TO_COUNTRY_MAP[code];
      if (
        !code ||
        !mappedCountry ||
        code === 'xx' ||
        code === 'zxx' ||
        !englishName ||
        /no language/i.test(englishName)
      ) {
        continue;
      }

      const existing = byCode.get(code);
      const nativeName = (dto.name || '').trim() || existing?.nativeLabel || englishName;
      const isIndian = INDIAN_ISO_CODES.has(code);

      if (existing) {
        byCode.set(code, {
          ...existing,
          originCountry: existing.originCountry || mappedCountry,
          nativeLabel: existing.nativeLabel || nativeName
        });
      } else {
        byCode.set(code, {
          code,
          label: englishName,
          nativeLabel: nativeName,
          badge: isIndian ? `${englishName} Cinema` : `${englishName} World Cinema`,
          group: isIndian ? 'indian' : 'global',
          originCountry: mappedCountry
        });
      }
    }

    return Array.from(byCode.values());
  }

  private loadCachedLanguagesCatalog(): DiscoverLanguageOption[] {
    try {
      localStorage.removeItem(STORAGE_KEY_TMDB_LANGUAGES_LEGACY);
      const raw = localStorage.getItem(STORAGE_KEY_TMDB_LANGUAGES);
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: DiscoverLanguageOption[] };
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          return parsed.items;
        }
      }
    } catch {
      // Ignore corrupt cache
    }
    return [...DISCOVER_LANGUAGE_OPTIONS];
  }

  public getLanguageOption(code: DiscoverLanguageCode): DiscoverLanguageOption {
    const found = this.allAvailableLanguages().find((l) => l.code === code);
    if (found) return found;
    const isIndian = INDIAN_ISO_CODES.has(code);
    return {
      code,
      label: code.toUpperCase(),
      nativeLabel: code.toUpperCase(),
      badge: `${code.toUpperCase()} Cinema`,
      group: isIndian ? 'indian' : 'global',
      originCountry: ISO_639_1_TO_COUNTRY_MAP[code] || (isIndian ? 'IN' : '')
    };
  }

  private loadStoredPreferences(): DiscoverPreferencesState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISCOVER_PREFS);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DiscoverPreferencesState>;
        const validGenreKeys = new Set(DISCOVER_GENRE_OPTIONS.map((g) => g.key));
        const validVibeKeys = new Set(DISCOVER_VIBE_OPTIONS.map((v) => v.key));

        const preferredLanguages = Array.isArray(parsed.preferredLanguages)
          ? parsed.preferredLanguages.filter(
              (c): c is DiscoverLanguageCode => typeof c === 'string' && c.trim().length >= 2
            )
          : DEFAULT_DISCOVER_PREFERENCES.preferredLanguages;

        const favoriteGenres = Array.isArray(parsed.favoriteGenres)
          ? parsed.favoriteGenres.filter((k): k is DiscoverGenreKey => validGenreKeys.has(k))
          : DEFAULT_DISCOVER_PREFERENCES.favoriteGenres;

        const favoriteVibes = Array.isArray(parsed.favoriteVibes)
          ? parsed.favoriteVibes.filter((k): k is DiscoverVibeKey => validVibeKeys.has(k))
          : DEFAULT_DISCOVER_PREFERENCES.favoriteVibes;

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
          favoriteVibes,
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
      favoriteVibes: [...DEFAULT_DISCOVER_PREFERENCES.favoriteVibes],
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

  private loadStoredAiTasteCache(): AiTasteCachePayload | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AI_TASTE_CACHE);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AiTasteCachePayload;
      if (
        typeof parsed?.generatedAt === 'number' &&
        typeof parsed?.expiresAt === 'number' &&
        Array.isArray(parsed?.lanes)
      ) {
        return parsed;
      }
    } catch {
      // Ignore corrupt AI taste cache
    }
    return null;
  }

  public getValidAiTasteCache(): AiTasteCachePayload | null {
    const cache = this.aiTasteCache();
    if (!cache) return null;
    if (Date.now() >= cache.expiresAt) {
      return null;
    }
    return cache;
  }

  public saveAiTasteCache(lanes: AiTasteCachedLane[], seedSummary: string): AiTasteCachePayload {
    const now = Date.now();
    const payload: AiTasteCachePayload = {
      generatedAt: now,
      expiresAt: now + AI_TASTE_TTL_MS,
      seedSummary,
      lanes
    };
    this.aiTasteCache.set(payload);
    try {
      localStorage.setItem(STORAGE_KEY_AI_TASTE_CACHE, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
    return payload;
  }

  public clearAiTasteCache(): void {
    this.aiTasteCache.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY_AI_TASTE_CACHE);
    } catch {
      // Ignore storage errors
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

  public isVibeSelected(key: DiscoverVibeKey): boolean {
    return this.favoriteVibes().includes(key);
  }

  public toggleVibe(key: DiscoverVibeKey): void {
    const current = this.favoriteVibes();
    const exists = current.includes(key);
    const updatedVibes = exists ? current.filter((k) => k !== key) : [...current, key];

    this.state.update((prev) => {
      const next: DiscoverPreferencesState = {
        ...prev,
        favoriteVibes: updatedVibes
      };
      this.persist(next);
      return next;
    });
  }

  public async toggleTabVisibility(tabId: DiscoverTabId): Promise<void> {
    const currentVis = this.tabVisibility();
    const nextVal = !currentVis[tabId];

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
      favoriteVibes: [...DEFAULT_DISCOVER_PREFERENCES.favoriteVibes],
      tabVisibility: { ...DEFAULT_DISCOVER_TAB_VISIBILITY },
      hideWatchedInDiscover: DEFAULT_DISCOVER_PREFERENCES.hideWatchedInDiscover
    };
    this.state.set(defaults);
    this.persist(defaults);
    await this.toast.presentSuccess('Restored default Discover & Taste preferences', 2000);
  }
}
