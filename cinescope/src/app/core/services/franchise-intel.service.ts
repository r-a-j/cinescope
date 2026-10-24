import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FranchiseIntelResponse, FranchisePart } from '../models/franchise.model';
import { TmdbSearchService, TmdbMultiSearchResultDto } from './tmdb-search.service';

const COOLDOWN_KEY_PREFIX = 'cinescope_universe_cooldown_';
const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface FranchiseIntelAnalysisResult {
  isCooldown: boolean;
  hoursRemaining?: number | undefined;
  message?: string | undefined;
  data?: FranchiseIntelResponse | null | undefined;
}

function cleanNorm(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeSimilarity(s1: string, s2: string): number {
  const norm1 = cleanNorm(s1);
  const norm2 = cleanNorm(s2);
  if (norm1 === norm2) return 1;
  if (!norm1 || !norm2) return 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.85;

  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

@Injectable({
  providedIn: 'root'
})
export class FranchiseIntelService {
  private readonly http = inject(HttpClient);
  private readonly tmdbSearch = inject(TmdbSearchService);
  private readonly bffUrl = `${environment.apiUrl}/franchise-intel`;

  /**
   * Checks if a collection is on cooldown in production mode.
   */
  public getCooldownStatus(collectionId: number | string): { isCooldown: boolean; hoursRemaining: number } {
    if (isDevMode()) {
      return { isCooldown: false, hoursRemaining: 0 };
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(`${COOLDOWN_KEY_PREFIX}${collectionId}`);
        if (raw) {
          const timestamp = parseInt(raw, 10);
          const elapsed = Date.now() - timestamp;
          if (elapsed < COOLDOWN_DURATION_MS) {
            const hoursRemaining = Math.max(1, Math.ceil((COOLDOWN_DURATION_MS - elapsed) / (60 * 60 * 1000)));
            return { isCooldown: true, hoursRemaining };
          }
        }
      }
    } catch {
      // Safe fallback
    }

    return { isCooldown: false, hoursRemaining: 0 };
  }

  /**
   * Dispatches collection payload to the AI BFF endpoint to reason universe hierarchy.
   */
  public async analyzeUniverse(
    collectionId: number,
    collectionName: string,
    parts?: FranchisePart[]
  ): Promise<FranchiseIntelAnalysisResult> {
    const cooldown = this.getCooldownStatus(collectionId);
    if (cooldown.isCooldown) {
      return {
        isCooldown: true,
        hoursRemaining: cooldown.hoursRemaining,
        message: `Next scan available in ${cooldown.hoursRemaining} hrs`
      };
    }

    try {
      const response = await firstValueFrom(
        this.http.post<FranchiseIntelResponse>(this.bffUrl, {
          collectionId,
          collectionName,
          parts: (parts || []).map((p) => ({
            id: p.id,
            title: p.title,
            release_date: p.release_date
          }))
        })
      );

      // Record cooldown in production
      if (!isDevMode() && typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(`${COOLDOWN_KEY_PREFIX}${collectionId}`, Date.now().toString());
        } catch {
          // LocalStorage quota safe
        }
      }

      return {
        isCooldown: false,
        data: response
      };
    } catch (err) {
      console.error('[FranchiseIntelService] AI Universe analysis failed:', err);
      return {
        isCooldown: false,
        data: null
      };
    }
  }

  /**
   * Resolves Gemini proposed canon titles against TMDB with strict title matching.
   */
  public async resolveCanonItems(
    canonTitles: {
      title: string;
      year?: number | undefined;
      media_type?: 'movie' | 'tv' | undefined;
      importance?: 'essential' | 'recommended' | 'optional' | undefined;
    }[]
  ): Promise<FranchisePart[]> {
    const resolvedParts: FranchisePart[] = [];

    for (const canon of canonTitles) {
      const targetTitle = canon.title?.trim();
      if (!targetTitle) continue;

      try {
        const searchRes = await firstValueFrom(this.tmdbSearch.searchMulti(targetTitle, 1));
        const candidates = (searchRes?.results || []).filter(
          (r): r is (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' }) =>
            r.media_type === 'movie' || r.media_type === 'tv'
        );

        const bestMatch = this.pickBestCandidate(targetTitle, candidates, canon);

        if (bestMatch) {
          const isTv = bestMatch.media_type === 'tv';
          const officialTitle = (isTv ? bestMatch.name : bestMatch.title) || targetTitle;
          const rawDate = isTv ? bestMatch.first_air_date : bestMatch.release_date;

          // TMDB authoritative metadata always overwrites AI placeholder
          resolvedParts.push({
            id: bestMatch.id,
            title: officialTitle,
            mediaType: isTv ? 'tv' : 'movie',
            overview: bestMatch.overview,
            poster_path: bestMatch.poster_path,
            backdrop_path: bestMatch.backdrop_path,
            release_date: !isTv ? rawDate : undefined,
            first_air_date: isTv ? rawDate : undefined,
            vote_average: bestMatch.vote_average,
            vote_count: bestMatch.vote_count
          });
        }
      } catch {
        // Skip unresolvable title
      }
    }

    return resolvedParts;
  }

  /**
   * Strictly matches candidates against target title, rejecting low-confidence matches.
   */
  private pickBestCandidate(
    targetTitle: string,
    candidates: (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' })[],
    hint: { year?: number | undefined; media_type?: 'movie' | 'tv' | undefined }
  ): (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' }) | null {
    if (candidates.length === 0) return null;

    let bestCandidate: (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' }) | null = null;
    let highestScore = 0;

    for (const c of candidates) {
      const cTitle = (c.media_type === 'tv' ? c.name : c.title) || '';
      const similarity = computeSimilarity(targetTitle, cTitle);

      // Require minimum 0.55 title similarity
      if (similarity < 0.55) continue;

      let score = similarity;

      // Bonus for media type match
      if (hint.media_type && c.media_type === hint.media_type) {
        score += 0.2;
      }

      // Bonus for release year proximity
      const dateStr = c.media_type === 'tv' ? c.first_air_date : c.release_date;
      if (hint.year && dateStr && dateStr.length >= 4) {
        const cYear = parseInt(dateStr.slice(0, 4), 10);
        if (!isNaN(cYear)) {
          const diff = Math.abs(cYear - hint.year);
          if (diff === 0) score += 0.25;
          else if (diff <= 1) score += 0.15;
          else if (diff > 5) score -= 0.3; // Penalize large year discrepancy
        }
      }

      if (score > highestScore && score >= 0.65) {
        highestScore = score;
        bestCandidate = c;
      }
    }

    return bestCandidate;
  }
}
