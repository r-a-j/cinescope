import { ContentDocType } from '../../core/database/schemas/content.schema';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';
import { TmdbWatchProviderDto } from '../../core/dtos/watch-providers/watch-provider.dto';
import { TmdbMovieWatchProvidersResponseDto } from '../../core/dtos/movies/movie-watch-providers.dto';
import {
  TimeOfDayContext,
  resolveTimeOfDayContext
} from '../../core/services/time-context.service';

export type CineMatchMood =
  | 'all'
  | 'quick'
  | 'mind_bending'
  | 'adrenaline'
  | 'popcorn'
  | 'cozy'
  | 'acclaimed';

export interface MoodFilterOption {
  id: CineMatchMood;
  label: string;
  icon: string;
  badge?: string | undefined;
}

export interface MoviesSectionVisibility {
  cineMatch: boolean;
  franchises: boolean;
  blindTicket: boolean;
}

export const DEFAULT_MOVIES_VISIBILITY: MoviesSectionVisibility = {
  cineMatch: true,
  franchises: true,
  blindTicket: true
};

export const TMDB_GENRE_NAMES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Doc',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10752: 'War',
  37: 'Western'
};

export type TimeOfDayGreeting = TimeOfDayContext;

export function getTimeOfDayGreeting(now: Date = new Date()): TimeOfDayGreeting {
  return resolveTimeOfDayContext(now);
}

export interface ContextualHook {
  emoji: string;
  badge: string;
  text: string;
}

export function getContextualHook(doc: ContentDocType | null): ContextualHook {
  if (!doc?.payload) {
    return {
      emoji: '🍿',
      badge: 'Featured Pick',
      text: 'Handpicked from your Watchlist'
    };
  }

  const p = doc.payload as Record<string, unknown>;
  const rating = Number(p['vote_average'] || 0);
  const runtime = Number(p['runtime'] || 0);
  const addedAt = doc.addedAt ? new Date(doc.addedAt).getTime() : Date.now();
  const daysAgo = Math.floor((Date.now() - addedAt) / (1000 * 60 * 60 * 24));

  let genreIds: number[] = [];
  if (Array.isArray(p['genre_ids'])) {
    genreIds = p['genre_ids'].map(Number);
  } else if (Array.isArray(p['genres'])) {
    genreIds = (p['genres'] as (Record<string, unknown> | number)[]).map(g =>
      typeof g === 'object' && g !== null ? Number(g['id'] || 0) : Number(g)
    );
  }

  if (rating >= 8.3) {
    return {
      emoji: '🏆',
      badge: 'Critically Acclaimed',
      text: `★ ${rating.toFixed(1)} rating • Top rated cinema in your library`
    };
  }

  if (runtime > 0 && runtime <= 90) {
    return {
      emoji: '⏱️',
      badge: 'Zero Commitment',
      text: `${runtime}m runtime • Easy, low-commitment watch`
    };
  }

  if (daysAgo >= 60) {
    return {
      emoji: '⏳',
      badge: 'Forgotten Bookmark',
      text: `Added ${daysAgo} days ago • Time to give this another look!`
    };
  }

  if (genreIds.some(id => [9648, 878].includes(id))) {
    return {
      emoji: '🤯',
      badge: 'Mind-Bender',
      text: 'Twisting plot & conceptual depth to keep you hooked'
    };
  }

  if (genreIds.some(id => [28, 53].includes(id))) {
    return {
      emoji: '⚡',
      badge: 'High Adrenaline',
      text: 'Fast-paced tension with non-stop momentum'
    };
  }

  return {
    emoji: '🍿',
    badge: 'Curated For You',
    text: 'Tailored recommendation from your Watchlist'
  };
}

export function getMovieTitle(doc: ContentDocType | null): string {
  if (!doc?.payload) return 'Unknown Title';
  const p = doc.payload as Record<string, unknown>;
  return String(p['title'] || p['name'] || 'Untitled');
}

export function getMoviePoster(doc: ContentDocType | null): string {
  if (!doc?.payload) return 'assets/placeholder-poster.png';
  const p = doc.payload as Record<string, unknown>;
  const path = (p['poster_path'] || p['posterUrl']) as string | undefined;
  return resolveMediaImageUrl(path, 'w500');
}

export function getMovieBackdrop(doc: ContentDocType | null): string {
  if (!doc?.payload) return '';
  const p = doc.payload as Record<string, unknown>;
  const path = (p['backdrop_path'] || p['backdropUrl']) as string | undefined;
  return resolveMediaImageUrl(path, 'w1280');
}

export function getMovieYear(doc: ContentDocType | null): string {
  if (!doc?.payload) return '';
  const p = doc.payload as Record<string, unknown>;
  const rawDate = (p['release_date'] || p['first_air_date'] || '') as string;
  return rawDate ? rawDate.substring(0, 4) : '';
}

export function getMovieRating(doc: ContentDocType | null): string {
  if (!doc?.payload) return '';
  const p = doc.payload as Record<string, unknown>;
  const vote = Number(p['vote_average'] || 0);
  return vote > 0 ? vote.toFixed(1) : '';
}

export function getMovieRuntime(doc: ContentDocType | null): string {
  if (!doc?.payload) return '';
  const p = doc.payload as Record<string, unknown>;
  const minutes = Number(p['runtime'] || 0);
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export function getAddedTimeAgo(addedAt: string | undefined): string {
  if (!addedAt) return 'Added recently';
  const addedDate = new Date(addedAt);
  const diffDays = Math.floor((Date.now() - addedDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Added today';
  if (diffDays === 1) return 'Added yesterday';
  if (diffDays < 7) return `Added ${diffDays}d ago`;
  if (diffDays < 30) return `Added ${Math.floor(diffDays / 7)}w ago`;
  return `Added ${Math.floor(diffDays / 30)}mo ago`;
}

export function getMovieOverview(doc: ContentDocType | null): string {
  if (!doc?.payload) return '';
  const p = doc.payload as Record<string, unknown>;
  return String(p['overview'] || '');
}

export function getMovieGenres(doc: ContentDocType | null): string[] {
  if (!doc?.payload) return [];
  const p = doc.payload as Record<string, unknown>;
  if (Array.isArray(p['genres'])) {
    return (p['genres'] as (Record<string, unknown> | string)[])
      .map(g => (typeof g === 'object' && g !== null ? String(g['name'] || '') : String(g)))
      .filter(Boolean)
      .slice(0, 3);
  }
  if (Array.isArray(p['genre_ids'])) {
    return (p['genre_ids'] as number[]).map((id: number) => TMDB_GENRE_NAMES[id]).filter(Boolean).slice(0, 3);
  }
  return [];
}

export interface StreamingAvailability {
  region: string;
  type: 'flatrate' | 'rent_buy' | 'other_regions' | 'none';
  providers: TmdbWatchProviderDto[];
  label: string;
  subtext?: string;
}

export function resolveStreamingDetails(
  resp: TmdbMovieWatchProvidersResponseDto | null | undefined,
  userRegion: string
): StreamingAvailability {
  const reg = (userRegion || 'US').trim().toUpperCase();
  if (!resp || !resp.results) {
    return {
      region: reg,
      type: 'none',
      providers: [],
      label: `NOT STREAMING IN ${reg}`,
      subtext: 'No streaming data available'
    };
  }

  const regionData = resp.results[reg];

  // 1. Subscription, free, or ad-supported streaming in user's region
  const streamProviders = [
    ...(regionData?.flatrate || []),
    ...(regionData?.free || []),
    ...(regionData?.ads || [])
  ];
  if (streamProviders.length > 0) {
    const unique = streamProviders.filter((prov, idx, self) =>
      idx === self.findIndex(p => p.provider_id === prov.provider_id)
    );
    unique.sort((a, b) => a.display_priority - b.display_priority);
    return {
      region: reg,
      type: 'flatrate',
      providers: unique.slice(0, 4),
      label: `STREAMING IN ${reg}`
    };
  }

  // 2. Rent or buy options in user's region
  const rentBuyProviders = [
    ...(regionData?.rent || []),
    ...(regionData?.buy || [])
  ];
  if (rentBuyProviders.length > 0) {
    const unique = rentBuyProviders.filter((prov, idx, self) =>
      idx === self.findIndex(p => p.provider_id === prov.provider_id)
    );
    unique.sort((a, b) => a.display_priority - b.display_priority);
    return {
      region: reg,
      type: 'rent_buy',
      providers: unique.slice(0, 4),
      label: `RENT / BUY IN ${reg}`
    };
  }

  // 3. Not in user's region: check if streaming in other regions
  const allRegions = Object.keys(resp.results);
  const otherRegions: { code: string; providers: TmdbWatchProviderDto[] }[] = [];

  for (const code of allRegions) {
    if (code === reg) continue;
    const r = resp.results[code];
    const fp = [...(r?.flatrate || []), ...(r?.free || [])];
    if (fp.length > 0) {
      otherRegions.push({ code, providers: fp });
    }
  }

  if (otherRegions.length > 0) {
    const topRegions = otherRegions.slice(0, 3).map(r => r.code).join(', ');
    const topProvider = otherRegions[0].providers[0]?.provider_name;
    const subtext = topProvider
      ? `Available on ${topProvider} in ${topRegions}`
      : `Streaming in ${topRegions}`;

    const gatheredProviders: TmdbWatchProviderDto[] = [];
    for (const item of otherRegions) {
      for (const p of item.providers) {
        if (!gatheredProviders.some(existing => existing.provider_id === p.provider_id)) {
          gatheredProviders.push(p);
        }
      }
    }

    return {
      region: reg,
      type: 'other_regions',
      providers: gatheredProviders.slice(0, 3),
      label: `NOT STREAMING IN ${reg}`,
      subtext
    };
  }

  // 4. Not available anywhere
  return {
    region: reg,
    type: 'none',
    providers: [],
    label: `NOT STREAMING IN ${reg}`,
    subtext: 'Theatrical release or not yet on OTT'
  };
}
