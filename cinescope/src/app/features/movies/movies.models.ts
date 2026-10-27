import { ContentDocType } from '../../core/database/schemas/content.schema';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

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
  graveyard: boolean;
  swimlanes: boolean;
}

export const DEFAULT_MOVIES_VISIBILITY: MoviesSectionVisibility = {
  cineMatch: true,
  franchises: true,
  blindTicket: true,
  graveyard: true,
  swimlanes: true
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
