import { Injectable, inject, isDevMode, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { FranchiseCollectionSummary, FranchiseIntelResponse, FranchisePart } from '../models/franchise.model';
import { FranchiseAggregatorService } from './franchise-aggregator.service';
import { ToastService } from './toast.service';
import { TmdbSearchService, TmdbMultiSearchResultDto } from './tmdb-search.service';
import { TmdbDiscoverService } from './tmdb-discover.service';
import { TmdbCollectionsService } from './tmdb-collections.service';

const COOLDOWN_KEY_PREFIX = 'cinescope_universe_cooldown_v2_';
const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const INTEL_CACHE_PREFIX = 'cinescope_universe_intel_cache_v2_';
const INTEL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CANON_RESOLVE_BATCH_SIZE = 5;

interface CachedIntelRecord {
  cachedAt: number;
  data: FranchiseIntelResponse;
}

export interface FranchiseIntelAnalysisResult {
  isCooldown: boolean;
  isCancelled?: boolean | undefined;
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
  private readonly tmdbDiscover = inject(TmdbDiscoverService);
  private readonly tmdbCollections = inject(TmdbCollectionsService);
  private readonly bffUrl = `${environment.apiUrl}/franchise-intel`;
  private readonly franchiseAggregator = inject(FranchiseAggregatorService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  public readonly activeJob = signal<{
    jobId: string;
    seedCollectionId?: number | undefined;
    universeId: string;
    universeTitle: string;
    phase: 'resolving' | 'expanding';
    resolvedCount: number;
    totalCount: number;
    resolvedParts?: FranchisePart[] | undefined;
  } | null>(null);
  public readonly lastCompletedUniverse = signal<FranchiseCollectionSummary | null>(null);

  private jobAbortController: AbortController | null = null;

  public cancelActiveJob(): void {
    if (this.jobAbortController) {
      this.jobAbortController.abort();
      this.jobAbortController = null;
    }
    if (this.activeJob()) {
      this.activeJob.set(null);
      void this.toastService.presentInfo('Universe background build cancelled', 1800);
    }
  }

  /**
   * Checks if a collection is on cooldown in production mode.
   * If we already have a valid 30-day cached intelligence response for this collection, cooldown is bypassed (0 AI quota used).
   */
  public getCooldownStatus(collectionId: number | string): { isCooldown: boolean; hoursRemaining: number } {
    if (this.getCachedIntel(collectionId)) {
      return { isCooldown: false, hoursRemaining: 0 };
    }

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

  public getCachedIntel(collectionId: number | string): FranchiseIntelResponse | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(`${INTEL_CACHE_PREFIX}${collectionId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as CachedIntelRecord;
          if (parsed && parsed.data && Date.now() - parsed.cachedAt < INTEL_CACHE_TTL_MS) {
            return parsed.data;
          }
        }
      }
    } catch {
      // Safe fallback
    }
    return null;
  }

  private saveCachedIntel(collectionId: number | string, data: FranchiseIntelResponse): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const record: CachedIntelRecord = {
          cachedAt: Date.now(),
          data
        };
        const serialized = JSON.stringify(record);
        localStorage.setItem(`${INTEL_CACHE_PREFIX}${collectionId}`, serialized);

        // Cross-index sibling franchises so scanning any connected saga reuses this intelligence at 0 AI cost
        if (Array.isArray(data.siblingFranchises)) {
          for (const sib of data.siblingFranchises) {
            if (sib && typeof sib.id === 'number' && sib.id > 0) {
              localStorage.setItem(`${INTEL_CACHE_PREFIX}${sib.id}`, serialized);
            }
          }
        }
      }
    } catch {
      // Quota safe
    }
  }

  /**
   * Dispatches collection payload to the AI BFF endpoint to reason universe hierarchy.
   */
  public async analyzeUniverse(
    collectionId: number,
    collectionName: string,
    parts?: FranchisePart[],
    forceRefresh = false
  ): Promise<FranchiseIntelAnalysisResult> {
    // 1. Check 30-day local cache first (0 AI quota consumption)
    if (!forceRefresh) {
      const cached = this.getCachedIntel(collectionId);
      if (cached) {
        if (cached.siblingFranchises?.length) {
          const verifiedSiblings = await this.resolveSiblingCollections(cached.siblingFranchises, {
            id: collectionId,
            name: collectionName
          });
          cached.siblingFranchises = verifiedSiblings;
          this.saveCachedIntel(collectionId, cached);
        }
        return {
          isCooldown: false,
          data: cached
        };
      }

      const cooldown = this.getCooldownStatus(collectionId);
      if (cooldown.isCooldown) {
        return {
          isCooldown: true,
          hoursRemaining: cooldown.hoursRemaining,
          message: `Next scan available in ${cooldown.hoursRemaining} hrs`
        };
      }
    }

    try {
      const payload = {
        collectionId,
        collectionName,
        franchiseName: collectionName,
        models: environment.geminiModels,
        parts: (parts || []).map((p) => ({
          id: p.id,
          title: p.title,
          release_date: p.release_date
        })),
        knownTitles: (parts || []).map((p) => p.title)
      };

      const rawResponse = await firstValueFrom(
        this.http.post<Record<string, unknown>>(this.bffUrl, payload)
      );

      const response = this.normalizeResponse(rawResponse);
      if (response.siblingFranchises?.length) {
        response.siblingFranchises = await this.resolveSiblingCollections(response.siblingFranchises, {
          id: collectionId,
          name: collectionName
        });
      }
      this.saveCachedIntel(collectionId, response);

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
      if ((err as Error)?.name === 'EmptyError') {
        return { isCooldown: false, isCancelled: true, data: null };
      }
      console.error('[FranchiseIntelService] AI Universe analysis failed:', err);
      return {
        isCooldown: false,
        data: null
      };
    }
  }

  /**
   * Verifies AI-proposed sibling franchises against TMDB's official `/search/collection` API.
   * Non-existent collections (e.g. "Disney+ Canon Series") are pruned so the UI never shows dead pills,
   * and fuzzy names (e.g. "Thor Saga", "Spider-Man MCU") are resolved to their real TMDB Collection IDs & titles.
   */
  public async resolveSiblingCollections(
    rawSiblings: { id: number; name: string }[],
    seedCollection?: { id: number; name: string }
  ): Promise<{ id: number; name: string }[]> {
    if (!Array.isArray(rawSiblings) || rawSiblings.length === 0) {
      return seedCollection ? [seedCollection] : [];
    }

    const NON_COLLECTION_PATTERN = /disney\+|canon series|tv series|television|phase\s*\d|streaming|one-shots|specials|defenders|netflix/i;
    const seenIds = new Set<number>();
    const verified: { id: number; name: string }[] = [];

    if (seedCollection && seedCollection.id > 0 && seedCollection.id < 90000) {
      seenIds.add(seedCollection.id);
      verified.push({ id: seedCollection.id, name: seedCollection.name });
    }

    const tasks = rawSiblings.map(async (sib): Promise<{ id: number; name: string } | null> => {
      const rawName = (sib?.name || '').trim();
      if (!rawName || NON_COLLECTION_PATTERN.test(rawName)) {
        return null;
      }

      if (
        seedCollection &&
        (sib.id === seedCollection.id || cleanNorm(rawName) === cleanNorm(seedCollection.name))
      ) {
        return { id: seedCollection.id, name: seedCollection.name };
      }

      const wantsMcuOrAvengers = /\bmcu\b|\bavengers\b/i.test(rawName);
      const baseQuery = rawName
        .replace(/\b(mcu|dceu|dcu|canon|films|movies)\b/gi, '')
        .replace(/\s+(saga|collection|franchise|series|trilogy|anthology)$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!baseQuery || baseQuery.length < 2) {
        return null;
      }

      try {
        const res = await firstValueFrom(this.tmdbSearch.searchCollections(baseQuery, 1));
        const candidates = res?.results || [];
        if (candidates.length === 0) return null;

        const normBase = cleanNorm(baseQuery);
        let best = candidates[0] ?? null;
        let bestScore = -1;

        for (const c of candidates) {
          const cNormFull = cleanNorm(c.name);
          const cNormCore = cleanNorm(c.name.replace(/\bcollection\b/gi, '').trim());
          let score = computeSimilarity(normBase, cNormCore);

          if (cNormCore === normBase || cNormFull === `${normBase} collection`) {
            score += 0.5;
          } else if (cNormCore.startsWith(normBase)) {
            score += 0.25;
          }

          if (wantsMcuOrAvengers && /\bavengers\b/i.test(c.name)) {
            score += 0.4;
          }

          // If AI happened to provide the exact matching TMDB ID, boost it
          if (sib.id > 0 && sib.id === c.id) {
            score += 0.5;
          }

          if (score > bestScore) {
            bestScore = score;
            best = c;
          }
        }

        if (best && bestScore >= 0.45) {
          return {
            id: best.id,
            name: best.name
          };
        }
      } catch {
        // Ignore network error for single candidate
      }

      return null;
    });

    const resolvedList = await Promise.all(tasks);
    for (const item of resolvedList) {
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        verified.push(item);
      }
    }

    return verified;
  }

  private normalizeResponse(raw: Record<string, unknown>): FranchiseIntelResponse {
    const isShared = Boolean(raw['isSharedUniverse'] ?? raw['isSubFranchise']);
    const parentUniverse = raw['parentUniverse'] as Record<string, unknown> | undefined;
    const universeTitle = (raw['universeTitle'] || parentUniverse?.['name'] || raw['universeName']) as string | undefined;
    const connectionInsight = (raw['connectionInsight'] || parentUniverse?.['connectionInsight']) as string | undefined;

    const rawCanon = (raw['canonTitles'] || []) as {
      title: string;
      year?: number;
      mediaType?: 'movie' | 'tv';
      media_type?: 'movie' | 'tv';
      importance?: 'essential' | 'recommended' | 'optional';
    }[];

    const canonTitles = rawCanon.map((c) => ({
      title: c.title,
      year: c.year,
      media_type: (c.media_type || c.mediaType || 'movie') as 'movie' | 'tv',
      importance: c.importance || 'essential'
    }));

    let siblingFranchises = raw['siblingFranchises'] as { id: number; name: string }[] | undefined;
    if (!siblingFranchises && Array.isArray(parentUniverse?.['siblingSagas'])) {
      siblingFranchises = (parentUniverse['siblingSagas'] as string[]).map((name, idx) => ({
        id: 90000 + idx,
        name
      }));
    }

    const universeId = (raw['universeId'] || (universeTitle ? universeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'universe')) as string;

    return {
      isSharedUniverse: isShared,
      universeTitle,
      universeId,
      connectionInsight,
      canonTitles,
      siblingFranchises,
      recommendedWatchOrder: raw['recommendedWatchOrder'] as string[] | undefined
    };
  }

  /**
   * Resolves Gemini proposed canon titles against TMDB with strict title matching,
   * reusing known collection parts in O(1) and resolving remaining items in parallel batches.
   */
  public async resolveCanonItems(
    canonTitles: {
      title: string;
      year?: number | undefined;
      media_type?: 'movie' | 'tv' | undefined;
      importance?: 'essential' | 'recommended' | 'optional' | undefined;
    }[],
    knownParts: FranchisePart[] = [],
    onProgress?: (resolved: number, total: number, currentParts?: FranchisePart[]) => void,
    abortSignal?: AbortSignal
  ): Promise<FranchisePart[]> {
    const knownByNormTitle = new Map<string, FranchisePart>();
    for (const kp of knownParts) {
      if (kp.title) {
        knownByNormTitle.set(cleanNorm(kp.title), kp);
      }
    }

    const orderedSlots: (FranchisePart | null)[] = new Array(canonTitles.length).fill(null);
    let completedCount = 0;

    const resolveSingle = async (
      canon: {
        title: string;
        year?: number | undefined;
        media_type?: 'movie' | 'tv' | undefined;
        importance?: 'essential' | 'recommended' | 'optional' | undefined;
      },
      index: number
    ): Promise<void> => {
      const rawTitle = canon.title?.trim();
      if (!rawTitle) return;

      // Extract inline [TV] / [MOVIE] or (YYYY) if Gemini embedded them in the title string
      let inferredType = canon.media_type;
      if (!inferredType && /\[tv\]|\(tv\)/i.test(rawTitle)) {
        inferredType = 'tv';
      }

      let inferredYear = canon.year;
      const yearMatch = rawTitle.match(/\((\d{4})\)/);
      if (!inferredYear && yearMatch) {
        inferredYear = parseInt(yearMatch[1], 10);
      }

      const targetTitle = rawTitle
        .replace(/\[(tv|movie|series|film)\]/gi, '')
        .replace(/\(\d{4}\)/g, '')
        .trim();

      if (!targetTitle) return;

      // 1. O(1) Check against already-loaded collection parts (0 network calls!)
      const knownMatch = knownByNormTitle.get(cleanNorm(targetTitle));
      if (knownMatch && knownMatch.poster_path) {
        orderedSlots[index] = {
          ...knownMatch,
          mediaType: knownMatch.mediaType || inferredType || 'movie',
          importance: canon.importance || 'essential'
        };
        return;
      }

      // 2. Query TMDB Search Multi
      try {
        const searchRes = await firstValueFrom(this.tmdbSearch.searchMulti(targetTitle, 1));
        const candidates = (searchRes?.results || []).filter(
          (r): r is (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' }) =>
            r.media_type === 'movie' || r.media_type === 'tv'
        );

        const bestMatch = this.pickBestCandidate(targetTitle, candidates, {
          year: inferredYear,
          media_type: inferredType
        });

        if (bestMatch) {
          const isTv = bestMatch.media_type === 'tv';
          const officialTitle = (isTv ? bestMatch.name : bestMatch.title) || targetTitle;
          const rawDate = isTv ? bestMatch.first_air_date : bestMatch.release_date;

          orderedSlots[index] = {
            id: bestMatch.id,
            title: officialTitle,
            mediaType: isTv ? 'tv' : 'movie',
            overview: bestMatch.overview,
            poster_path: bestMatch.poster_path,
            backdrop_path: bestMatch.backdrop_path,
            release_date: rawDate,
            first_air_date: isTv ? rawDate : undefined,
            vote_average: bestMatch.vote_average,
            vote_count: bestMatch.vote_count,
            importance: canon.importance || 'essential'
          };
        }
      } catch {
        // Skip unresolvable title
      }
    };

    const buildCurrentDeduplicated = (): FranchisePart[] => {
      const seen = new Set<string>();
      const list: FranchisePart[] = [];
      for (const p of orderedSlots) {
        if (!p) continue;
        const key = `${p.mediaType || 'movie'}_${p.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(p);
        }
      }
      return list;
    };

    // Execute in concurrent batches of 5 to avoid sequential waterfall while respecting rate limits
    for (let i = 0; i < canonTitles.length; i += CANON_RESOLVE_BATCH_SIZE) {
      const batch = canonTitles.slice(i, i + CANON_RESOLVE_BATCH_SIZE);
      if (abortSignal?.aborted) {
        throw new DOMException('Universe build cancelled', 'AbortError');
      }
      await Promise.all(
        batch.map(async (item, batchIdx) => {
          if (abortSignal?.aborted) return;
          await resolveSingle(item, i + batchIdx);
          completedCount++;
        })
      );
      if (abortSignal?.aborted) {
        throw new DOMException('Universe build cancelled', 'AbortError');
      }
      onProgress?.(completedCount, canonTitles.length, buildCurrentDeduplicated());
    }

    // Deduplicate by mediaType_id while preserving canonical order
    const seenKeys = new Set<string>();
    const deduplicated: FranchisePart[] = [];
    for (const part of orderedSlots) {
      if (!part) continue;
      const key = `${part.mediaType || 'movie'}_${part.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduplicated.push(part);
      }
    }

    return deduplicated;
  }

  /**
   * Augments AI-resolved canon parts with live TMDB data from:
   * 1. All verified sibling movie collections (`/collection/:id`)
   * 2. Official TMDB universe keywords & primary studio discovery (`/discover/movie` & `/discover/tv`)
   * This guarantees brand-new 2025/2026+ releases and upcoming titles (such as VisionQuest, Wonder Man,
   * Daredevil: Born Again, Thunderbolts*, Avengers: Doomsday, etc.) are included even if released after AI training cutoff.
   */
  public async expandUniverseWithLiveTmdb(
    universeTitle: string,
    universeId: string,
    baseParts: FranchisePart[],
    siblingCollections: { id: number; name: string }[] = []
  ): Promise<FranchisePart[]> {
    const NON_CANON_DOC_TITLE = /\b(assembled|mpower|legends|voices rising|making of|behind the scenes|fan's guide|stan lee|expanding the universe|celebrating|story of marvel)\b/i;

    const mergedMap = new Map<string, FranchisePart>();
    for (const part of baseParts) {
      const mType = part.mediaType || 'movie';
      mergedMap.set(`${mType}_${part.id}`, { ...part, mediaType: mType });
    }

    const isAuthenticCandidate = (part: FranchisePart, genreIds?: number[]): boolean => {
      if (!part.id || !part.title) return false;
      if (NON_CANON_DOC_TITLE.test(part.title)) return false;

      // Exclude Documentaries (genre 99), Talk Shows (10767), News (10763)
      if (Array.isArray(genreIds) && (genreIds.includes(99) || genreIds.includes(10767) || genreIds.includes(10763))) {
        return false;
      }

      // Check title for amateur / parody / bootleg markers
      const lower = part.title.toLowerCase();
      if (/\b(twink|parody|spoof|tribute|strawberry|strawberries|fan film|short film)\b/i.test(lower)) {
        return false;
      }

      // Require a poster path
      if (!part.poster_path) {
        return false;
      }

      // Strict Popularity & Vote Count Guard:
      // Real studio releases have substantial vote count and popularity.
      // Amateur/parody/fan films on TMDB have vote_count < 15 and negligible popularity.
      const rawDate = String(part.release_date || part.first_air_date || '').trim();
      const currentYear = new Date().getFullYear();
      const releaseYear = rawDate.length >= 4 ? parseInt(rawDate.slice(0, 4), 10) : 0;
      const voteCount = Number(part.vote_count ?? 0);

      // If already released, require at least 15 votes to exclude amateur/fake crowdsourced stubs
      if (releaseYear > 0 && releaseYear <= currentYear) {
        if (voteCount < 15) {
          return false;
        }
      }

      return true;
    };

    const addCandidatePart = (part: FranchisePart, genreIds?: number[]): void => {
      if (!isAuthenticCandidate(part, genreIds)) return;

      const mType = part.mediaType || 'movie';
      const key = `${mType}_${part.id}`;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          ...part,
          mediaType: mType,
          importance: part.importance || 'essential'
        });
      }
    };

    // 1. Fetch all movies from verified sibling collections in parallel
    const validSiblings = siblingCollections.filter((s) => s.id > 0 && s.id < 90000);
    await Promise.all(
      validSiblings.map(async (sib) => {
        try {
          const detail = await firstValueFrom(this.tmdbCollections.getCollectionDetails(sib.id));
          for (const p of detail?.parts || []) {
            addCandidatePart(
              {
                id: p.id,
                title: p.title,
                mediaType: 'movie',
                overview: p.overview,
                poster_path: p.poster_path,
                backdrop_path: p.backdrop_path,
                release_date: p.release_date,
                vote_average: p.vote_average,
                vote_count: p.vote_count
              },
              p.genre_ids
            );
          }
        } catch {
          // Ignore single collection failure
        }
      })
    );

    // 2. Live TMDB Keyword & Studio Discovery for Movies + TV Series
    try {
      const isMcu =
        universeId === 'mcu' ||
        universeId.includes('marvel_cinematic_universe') ||
        /marvel cinematic universe|\bmcu\b/i.test(universeTitle);

      // Only run keyword-based live discovery for MCU where TMDB maintains an official curated keyword ID (180547).
      // For all other universes, non-curated crowdsourced TMDB keywords return amateur shorts, parodies, and spam.
      const keywordId: number | null = isMcu ? 180547 : null;

      const discoverPromises: Promise<void>[] = [];

      if (keywordId) {
        const kwStr = String(keywordId);
        for (const page of [1, 2, 3]) {
          discoverPromises.push(
            firstValueFrom(this.tmdbDiscover.discoverMovies({ with_keywords: kwStr, sort_by: 'primary_release_date.asc', page }))
              .then((res) => {
                for (const m of res?.results || []) {
                  addCandidatePart(
                    {
                      id: m.id,
                      title: m.title,
                      mediaType: 'movie',
                      overview: m.overview,
                      poster_path: m.poster_path,
                      backdrop_path: m.backdrop_path,
                      release_date: m.release_date,
                      vote_average: m.vote_average,
                      vote_count: m.vote_count
                    },
                    m.genre_ids
                  );
                }
              })
              .catch(() => undefined)
          );
        }
        for (const page of [1, 2]) {
          discoverPromises.push(
            firstValueFrom(this.tmdbDiscover.discoverTv({ with_keywords: kwStr, sort_by: 'first_air_date.asc', page }))
              .then((res) => {
                for (const tv of res?.results || []) {
                  addCandidatePart(
                    {
                      id: tv.id,
                      title: tv.name,
                      mediaType: 'tv',
                      overview: tv.overview,
                      poster_path: tv.poster_path,
                      backdrop_path: tv.backdrop_path,
                      first_air_date: tv.first_air_date,
                      release_date: tv.first_air_date,
                      vote_average: tv.vote_average,
                      vote_count: tv.vote_count
                    },
                    tv.genre_ids
                  );
                }
              })
              .catch(() => undefined)
          );
        }
      }

      // For MCU, also query Marvel Studios (Company ID 420) for recent/upcoming TV & Movies so brand-new shows (e.g. VisionQuest, Wonder Man) are found even before community keyword tagging completes
      if (isMcu) {
        for (const sortBy of ['popularity.desc', 'first_air_date.desc'] as const) {
          discoverPromises.push(
            firstValueFrom(this.tmdbDiscover.discoverTv({ with_companies: '420', sort_by: sortBy, page: 1 }))
              .then((res) => {
                for (const tv of res?.results || []) {
                  addCandidatePart(
                    {
                      id: tv.id,
                      title: tv.name,
                      mediaType: 'tv',
                      overview: tv.overview,
                      poster_path: tv.poster_path,
                      backdrop_path: tv.backdrop_path,
                      first_air_date: tv.first_air_date,
                      release_date: tv.first_air_date,
                      vote_average: tv.vote_average,
                      vote_count: tv.vote_count
                    },
                    tv.genre_ids
                  );
                }
              })
              .catch(() => undefined)
          );
        }
        for (const sortBy of ['popularity.desc', 'primary_release_date.desc'] as const) {
          discoverPromises.push(
            firstValueFrom(this.tmdbDiscover.discoverMovies({ with_companies: '420', sort_by: sortBy, page: 1 }))
              .then((res) => {
                for (const m of res?.results || []) {
                  addCandidatePart(
                    {
                      id: m.id,
                      title: m.title,
                      mediaType: 'movie',
                      overview: m.overview,
                      poster_path: m.poster_path,
                      backdrop_path: m.backdrop_path,
                      release_date: m.release_date,
                      vote_average: m.vote_average,
                      vote_count: m.vote_count
                    },
                    m.genre_ids
                  );
                }
              })
              .catch(() => undefined)
          );
        }
      }

      await Promise.all(discoverPromises);
    } catch {
      // Safe fallback if TMDB discover fails
    }

    return Array.from(mergedMap.values()).sort((a, b) => {
      const dA = (a.release_date || a.first_air_date || '').trim();
      const dB = (b.release_date || b.first_air_date || '').trim();
      if (!dA && !dB) return 0;
      if (!dA) return 1;
      if (!dB) return -1;
      return dA.localeCompare(dB);
    });
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

  /**
   * Dispatches Universe canon resolution & live TMDB expansion to the background immediately
   * after the user confirms the Universe Proposal modal, freeing the UI and notifying upon completion.
   */
  public startBackgroundUniverseBuild(options: {
    proposal: FranchiseIntelResponse;
    currentParts: FranchisePart[];
    seedCollection?: { id: number; name: string } | undefined;
    fallbackOverview?: string | null | undefined;
    fallbackBackdropPath?: string | null | undefined;
    fallbackPosterPath?: string | null | undefined;
    foldSubCollection?: boolean | undefined;
  }): { universeId: string; universeTitle: string; seedSummary: FranchiseCollectionSummary } {
    const {
      proposal,
      currentParts,
      seedCollection,
      fallbackOverview,
      fallbackBackdropPath,
      fallbackPosterPath,
      foldSubCollection
    } = options;

    if (this.jobAbortController) {
      this.jobAbortController.abort();
    }
    const abortController = new AbortController();
    this.jobAbortController = abortController;

    const rawUniverseId = proposal.universeId || `universe_${Date.now()}`;
    const cleanKey = String(rawUniverseId).replace(/^(universe_)+/, '');
    const universeId = `universe_${cleanKey}`;
    const universeTitle = proposal.universeTitle || 'Shared Universe';
    const canonTitles = proposal.canonTitles || [];
    const jobId = `${universeId}_${Date.now()}`;

    const initialMergedIds = foldSubCollection !== false && seedCollection?.id
      ? [seedCollection.id]
      : [];

    const seedSummary: FranchiseCollectionSummary = {
      id: universeId,
      name: universeTitle,
      overview: proposal.connectionInsight || fallbackOverview || undefined,
      poster_path: fallbackPosterPath ?? currentParts.find((p) => p.poster_path)?.poster_path ?? null,
      backdrop_path: fallbackBackdropPath ?? currentParts.find((p) => p.backdrop_path)?.backdrop_path ?? null,
      totalParts: Math.max(currentParts.length, canonTitles.length),
      collectedCount: 0,
      watchedCount: 0,
      watchlistCount: 0,
      completionPercentage: 0,
      isUniverse: true,
      universeId,
      parentUniverseTitle: proposal.universeTitle,
      connectionInsight: proposal.connectionInsight,
      parts: currentParts,
      siblingFranchises: proposal.siblingFranchises || [],
      mergedSubCollectionIds: initialMergedIds
    };

    // 1. Immediately track seed universe in RxDB and reactive state
    void this.franchiseAggregator.trackFranchise(universeId, seedSummary);

    this.activeJob.set({
      jobId,
      seedCollectionId: seedCollection?.id,
      universeId,
      universeTitle,
      phase: 'resolving',
      resolvedCount: 0,
      totalCount: Math.max(1, canonTitles.length),
      resolvedParts: currentParts
    });

    void (async (): Promise<void> => {
      try {
        // 2. Resolve AI canon titles in parallel batches with live progress updates
        const baseResolvedParts = await this.resolveCanonItems(
          canonTitles,
          currentParts,
          (resolved, total, currentList) => {
            if (abortController.signal.aborted) return;
            this.activeJob.update((curr) =>
              curr && curr.jobId === jobId
                ? {
                    ...curr,
                    resolvedCount: resolved,
                    totalCount: total,
                    resolvedParts: currentList && currentList.length > 0 ? currentList : curr.resolvedParts
                  }
                : curr
            );
          },
          abortController.signal
        );

        if (abortController.signal.aborted) return;

        // 3. Verify sibling collections and expand with live TMDB 2024-2027+ releases
        this.activeJob.update((curr) =>
          curr && curr.jobId === jobId ? { ...curr, phase: 'expanding' } : curr
        );

        const rawSiblings = [...(proposal.siblingFranchises || [])];
        const siblings = await this.resolveSiblingCollections(rawSiblings, seedCollection);

        if (abortController.signal.aborted) return;

        const resolvedParts = await this.expandUniverseWithLiveTmdb(
          universeTitle,
          universeId,
          baseResolvedParts,
          siblings
        );

        if (abortController.signal.aborted) return;

        const rawBackdropPath =
          fallbackBackdropPath || resolvedParts.find((p) => p.backdrop_path)?.backdrop_path || null;
        const rawPosterPath =
          resolvedParts.find((p) => p.poster_path)?.poster_path || fallbackPosterPath || null;

        const completedSummary: FranchiseCollectionSummary & { canonExpandedV2?: boolean } = {
          id: universeId,
          name: universeTitle,
          overview: proposal.connectionInsight || fallbackOverview || undefined,
          poster_path: rawPosterPath,
          backdrop_path: rawBackdropPath,
          totalParts: resolvedParts.length,
          collectedCount: 0,
          watchedCount: 0,
          watchlistCount: 0,
          completionPercentage: 0,
          isUniverse: true,
          universeId,
          parentUniverseTitle: proposal.universeTitle,
          connectionInsight: proposal.connectionInsight,
          parts: resolvedParts,
          siblingFranchises: siblings,
          mergedSubCollectionIds: initialMergedIds,
          canonExpandedV2: true
        };

        await this.franchiseAggregator.trackFranchise(universeId, completedSummary);
        this.activeJob.set(null);
        this.lastCompletedUniverse.set(completedSummary);

        // 4. Notify user that their franchise universe is ready
        void this.toastService.presentSuccess(
          `"${universeTitle}" is ready (${resolvedParts.length} titles)!`,
          3500
        );
      } catch (err) {
        if ((err as Error)?.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        console.error('[FranchiseIntelService] Background universe build failed:', err);
        void this.toastService.presentError(`Could not finish building "${universeTitle}".`, 3000);
      } finally {
        if (this.activeJob()?.jobId === jobId) {
          this.activeJob.set(null);
        }
        if (this.jobAbortController === abortController) {
          this.jobAbortController = null;
        }
      }
    })();

    return { universeId, universeTitle, seedSummary };
  }
}
