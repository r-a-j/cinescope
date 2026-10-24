import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StorageService, checkMediaReleaseStatus } from './storage.service';
import { TmdbCollectionsService } from './tmdb-collections.service';
import { TmdbMoviesService } from './tmdb-movies.service';
import { FranchiseCollectionSummary, FranchisePart } from '../models/franchise.model';
import { TmdbCollectionDetailDto } from '../dtos/collections/collection-detail.dto';

interface CachedCollectionMeta {
  cachedAt: number;
  name: string;
  overview?: string | undefined;
  poster_path?: string | null | undefined;
  backdrop_path?: string | null | undefined;
  totalParts: number;
  parts: FranchisePart[];
}

const CACHE_PREFIX = 'cinescope_franchise_meta_';
const DISMISSED_FRANCHISES_KEY = 'cinescope_dismissed_franchises_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CONCURRENT_MOVIE_LOOKUPS = 4;

export function isPartReleased(part: FranchisePart, todayIso?: string): boolean {
  return checkMediaReleaseStatus(part as unknown as Record<string, unknown>, todayIso).isReleased;
}

@Injectable({
  providedIn: 'root'
})
export class FranchiseAggregatorService {
  private storage = inject(StorageService);
  private tmdbCollections = inject(TmdbCollectionsService);
  private tmdbMovies = inject(TmdbMoviesService);

  private readonly metaCache = new Map<number, CachedCollectionMeta>();
  private readonly dismissedIds = new Set<string>();
  private readonly inFlightRequests = new Set<number>();
  private readonly inFlightMovieLookups = new Set<number>();
  private readonly pendingMovieQueue: { tmdbId: number; docId: string }[] = [];
  private activeMovieLookupWorkers = 0;
  private readonly cacheRevision = signal<number>(0);

  constructor() {
    this.hydrateMemoryFromLocalStorage();

    // Trigger hydration whenever user library items change
    effect(() => {
      const watchlist = this.storage.watchlistItems();
      const watched = this.storage.watchedItems();
      this.syncMissingCollectionMetadata(watchlist, watched);
    });
  }

  /**
   * Checks whether a franchise or universe is currently tracked in the user's Franchises Hub
   * (either via collected movies or explicit tracking, and not dismissed).
   */
  public isFranchiseTracked(id: number | string): boolean {
    const idStr = String(id);
    if (this.dismissedIds.has(idStr)) return false;
    if (this.storage.isFranchiseSaved(id)) return true;
    return this.activeUserFranchises().some(
      (f) => String(f.id) === idStr || String(f.universeId) === idStr
    );
  }

  /**
   * Explicitly tracks a franchise or universe in the user's Franchises Hub (and clears any prior dismissal).
   */
  public async trackFranchise(id: number | string, summary: FranchiseCollectionSummary): Promise<void> {
    const idStr = String(id);
    if (this.dismissedIds.has(idStr)) {
      this.dismissedIds.delete(idStr);
      this.persistDismissedIds();
    }
    if (summary.isUniverse) {
      await this.storage.saveUniverse(idStr, summary);
    } else {
      await this.storage.saveFranchise(id, summary);
    }
    this.cacheRevision.update((r) => r + 1);
  }

  /**
   * Untracks / removes a franchise or universe from the user's Franchises Hub.
   * Also records dismissal so auto-detected single-movie collections do not reappear unless re-tracked.
   */
  public async untrackFranchise(id: number | string, isUniverse = false): Promise<void> {
    const idStr = String(id);
    this.dismissedIds.add(idStr);
    this.persistDismissedIds();

    if (isUniverse) {
      await this.storage.removeUniverse(id);
    } else {
      await this.storage.removeFranchise(id);
    }
    this.cacheRevision.update((r) => r + 1);
  }

  private persistDismissedIds(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(DISMISSED_FRANCHISES_KEY, JSON.stringify(Array.from(this.dismissedIds)));
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Computes released-aware completion stats and the chronological "Up Next" unwatched part.
   */
  public computePartsProgress(
    parts: FranchisePart[],
    watchedMediaKeys: Set<string>,
    watchlistMediaKeys: Set<string>,
    fallbackTotal = 1
  ): {
    totalParts: number;
    releasedPartsCount: number;
    upcomingPartsCount: number;
    watchedCount: number;
    watchlistCount: number;
    collectedCount: number;
    completionPercentage: number;
    upNextPart: FranchisePart | null;
  } {
    const todayIso = new Date().toISOString().slice(0, 10);

    if (!parts || parts.length === 0) {
      return {
        totalParts: fallbackTotal,
        releasedPartsCount: fallbackTotal,
        upcomingPartsCount: 0,
        watchedCount: 0,
        watchlistCount: 0,
        collectedCount: 0,
        completionPercentage: 0,
        upNextPart: null
      };
    }

    // Sort parts chronologically by release/air date (undated items at the end)
    const sortedParts = [...parts].sort((a, b) => {
      const dA = (a.release_date || a.first_air_date || '').trim();
      const dB = (b.release_date || b.first_air_date || '').trim();
      if (!dA && !dB) return 0;
      if (!dA) return 1;
      if (!dB) return -1;
      return dA.localeCompare(dB);
    });

    const hasAnyDatedPart = sortedParts.some((p) => Boolean((p.release_date || p.first_air_date || '').trim()));

    let releasedPartsCount = 0;
    let upcomingPartsCount = 0;
    let watchedCount = 0;
    let watchlistCount = 0;
    let upNextPart: FranchisePart | null = null;

    for (const part of sortedParts) {
      const type = part.mediaType || 'movie';
      const key = `${type}_${part.id}`;
      const isWatched = watchedMediaKeys.has(key);
      const isWatchlist = watchlistMediaKeys.has(key);

      const released = hasAnyDatedPart ? isPartReleased(part, todayIso) : true;
      if (released || isWatched) {
        releasedPartsCount++;
      } else {
        upcomingPartsCount++;
      }

      if (isWatched) {
        watchedCount++;
      } else if (isWatchlist) {
        watchlistCount++;
      }

      if (!isWatched && released && !upNextPart) {
        upNextPart = part;
      }
    }

    // Denominator for completion % uses released parts so future 2028/2030 announcements never block 100% completion
    const effectiveTotal = releasedPartsCount > 0 ? releasedPartsCount : sortedParts.length;
    const collectedCount = watchedCount + watchlistCount;
    const completionPercentage = effectiveTotal > 0
      ? Math.min(100, Math.round((watchedCount / effectiveTotal) * 100))
      : 0;

    return {
      totalParts: effectiveTotal,
      releasedPartsCount,
      upcomingPartsCount,
      watchedCount,
      watchlistCount,
      collectedCount,
      completionPercentage,
      upNextPart
    };
  }

  /**
   * Finds if a specific Movie or TV Show belongs to an active Universe or Franchise in the user's library.
   */
  public findFranchiseForMedia(tmdbId: number, mediaType: 'movie' | 'tv', collectionIdHint?: number | null): FranchiseCollectionSummary | null {
    const active = this.activeUserFranchises();
    // 1. Prefer an Ascended Universe that contains this Movie or TV series
    for (const f of active) {
      if (f.isUniverse && Array.isArray(f.parts)) {
        const match = f.parts.some((p) => Number(p.id) === Number(tmdbId) && (p.mediaType || 'movie') === mediaType);
        if (match) return f;
      }
    }
    // 2. Check by collectionIdHint or part membership in standard franchises
    if (collectionIdHint) {
      const byColId = active.find((f) => !f.isUniverse && Number(f.id) === Number(collectionIdHint));
      if (byColId) return byColId;
    }
    for (const f of active) {
      if (Array.isArray(f.parts)) {
        const match = f.parts.some((p) => Number(p.id) === Number(tmdbId) && (p.mediaType || 'movie') === mediaType);
        if (match) return f;
      }
    }
    return null;
  }

  /**
   * Reactive computed list of all franchises and universes derived from user library.
   */
  public readonly activeUserFranchises = computed<FranchiseCollectionSummary[]>(() => {
    // Read cacheRevision to recompute when new TMDB metadata finishes fetching
    this.cacheRevision();

    const watchlist = this.storage.watchlistItems();
    const watched = this.storage.watchedItems();
    const savedUniverses = this.storage.savedUniverses();
    const watchedMediaKeys = this.storage.watchedMediaKeys();
    const watchlistMediaKeys = new Set(watchlist.map((d) => d.id));

    const collectionMap = new Map<number, {
      id: number;
      name: string;
      overview?: string | undefined;
      poster_path?: string | null | undefined;
      backdrop_path?: string | null | undefined;
      savedParts?: FranchisePart[] | undefined;
      watchlistMovieIds: Set<number>;
      watchedMovieIds: Set<number>;
      isDirectlySaved?: boolean | undefined;
    }>();

    // Scan watchlist items
    for (const item of watchlist) {
      if (item.mediaType !== 'movie') continue;
      const payload = item.payload as Record<string, unknown> | undefined;
      const collection = payload?.['belongs_to_collection'] as {
        id: number;
        name: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
      } | null | undefined;

      if (!collection || !collection.id) continue;

      let group = collectionMap.get(collection.id);
      if (!group) {
        group = {
          id: collection.id,
          name: collection.name,
          poster_path: collection.poster_path,
          backdrop_path: collection.backdrop_path,
          watchlistMovieIds: new Set<number>(),
          watchedMovieIds: new Set<number>()
        };
        collectionMap.set(collection.id, group);
      }

      group.watchlistMovieIds.add(item.tmdbId);
    }

    // Scan watched items
    for (const item of watched) {
      if (item.mediaType !== 'movie') continue;
      const payload = item.payload as Record<string, unknown> | undefined;
      const collection = payload?.['belongs_to_collection'] as {
        id: number;
        name: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
      } | null | undefined;

      if (!collection || !collection.id) continue;

      let group = collectionMap.get(collection.id);
      if (!group) {
        group = {
          id: collection.id,
          name: collection.name,
          poster_path: collection.poster_path,
          backdrop_path: collection.backdrop_path,
          watchlistMovieIds: new Set<number>(),
          watchedMovieIds: new Set<number>()
        };
        collectionMap.set(collection.id, group);
      }

      group.watchedMovieIds.add(item.tmdbId);
    }

    const summaries: FranchiseCollectionSummary[] = [];
    const subsumedCollectionIds = new Set<number>();
    const universeMediaKeys = new Set<string>();

    // 1. Process AI-Ascended Universes & Directly Saved Franchises from RxDB first
    for (const uniDoc of savedUniverses) {
      const uniPayload = uniDoc.payload as unknown as FranchiseCollectionSummary | undefined;
      if (!uniPayload) continue;

      const isUniverse = Boolean(
        uniPayload.isUniverse ?? (uniDoc.lists ? uniDoc.lists.includes('universe') && !uniDoc.lists.includes('franchise') : false)
      );

      if (!isUniverse) {
        // Directly saved numeric TMDB Franchise: merge with collectionMap so cold cache still has full parts & artwork
        const numericId = typeof uniPayload.id === 'number'
          ? uniPayload.id
          : (typeof uniDoc.tmdbId === 'number' ? uniDoc.tmdbId : parseInt(String(uniPayload.id), 10));

        if (numericId && !isNaN(numericId)) {
          const existing = collectionMap.get(numericId);
          if (existing) {
            existing.isDirectlySaved = true;
            existing.overview = existing.overview || uniPayload.overview;
            existing.poster_path = existing.poster_path || uniPayload.poster_path;
            existing.backdrop_path = existing.backdrop_path || uniPayload.backdrop_path;
            existing.savedParts = uniPayload.parts;
          } else {
            collectionMap.set(numericId, {
              id: numericId,
              name: uniPayload.name,
              overview: uniPayload.overview,
              poster_path: uniPayload.poster_path,
              backdrop_path: uniPayload.backdrop_path,
              savedParts: uniPayload.parts,
              watchlistMovieIds: new Set<number>(),
              watchedMovieIds: new Set<number>(),
              isDirectlySaved: true
            });
          }
          continue;
        }
      }

      // True AI-Ascended Shared Universe
      const universeId = uniPayload.universeId || String(uniPayload.id || uniDoc.id);
      const canonParts = uniPayload.parts || [];

      // Track sibling franchises and media keys so redundant sub-collections are subsumed cleanly
      if (Array.isArray(uniPayload.siblingFranchises)) {
        for (const sib of uniPayload.siblingFranchises) {
          if (sib && typeof sib.id === 'number') {
            subsumedCollectionIds.add(sib.id);
          }
        }
      }
      for (const part of canonParts) {
        universeMediaKeys.add(`${part.mediaType || 'movie'}_${part.id}`);
      }

      const stats = this.computePartsProgress(
        canonParts,
        watchedMediaKeys,
        watchlistMediaKeys,
        uniPayload.totalParts || 1
      );

      const fallbackPoster = uniPayload.poster_path || canonParts.find((p) => p.poster_path)?.poster_path || null;
      const fallbackBackdrop = uniPayload.backdrop_path || canonParts.find((p) => p.backdrop_path)?.backdrop_path || null;

      summaries.push({
        id: universeId,
        name: uniPayload.name,
        overview: uniPayload.overview,
        poster_path: fallbackPoster,
        backdrop_path: fallbackBackdrop,
        totalParts: stats.totalParts,
        releasedPartsCount: stats.releasedPartsCount,
        upcomingPartsCount: stats.upcomingPartsCount,
        collectedCount: stats.collectedCount,
        watchedCount: stats.watchedCount,
        watchlistCount: stats.watchlistCount,
        completionPercentage: stats.completionPercentage,
        upNextPart: stats.upNextPart,
        isUniverse: true,
        universeId,
        parentUniverseTitle: uniPayload.parentUniverseTitle,
        connectionInsight: uniPayload.connectionInsight,
        parts: canonParts,
        siblingFranchises: uniPayload.siblingFranchises
      });
    }

    // 2. Process Movie Collections
    for (const [collectionId, group] of collectionMap.entries()) {
      // Respect user dismissal if they explicitly untracked this auto-detected collection
      if (!group.isDirectlySaved && this.dismissedIds.has(String(collectionId))) {
        continue;
      }

      // If this sub-collection wasn't explicitly bookmarked as a standalone franchise AND is already subsumed by an Ascended Universe, skip duplicate card
      if (!group.isDirectlySaved) {
        if (subsumedCollectionIds.has(collectionId)) {
          continue;
        }
        const userMovieIds = [...group.watchedMovieIds, ...group.watchlistMovieIds];
        if (userMovieIds.length > 0 && userMovieIds.every((mId) => universeMediaKeys.has(`movie_${mId}`))) {
          continue;
        }
      }

      const cached = this.metaCache.get(collectionId);
      const effectiveParts = cached?.parts || group.savedParts;

      let totalParts: number;
      let releasedPartsCount: number | undefined;
      let upcomingPartsCount: number | undefined;
      let watchedCount: number;
      let watchlistCount: number;
      let collectedCount: number;
      let completionPercentage: number;
      let upNextPart: FranchisePart | null = null;

      if (effectiveParts && effectiveParts.length > 0) {
        const stats = this.computePartsProgress(
          effectiveParts,
          watchedMediaKeys,
          watchlistMediaKeys,
          cached?.totalParts || effectiveParts.length
        );
        totalParts = stats.totalParts;
        releasedPartsCount = stats.releasedPartsCount;
        upcomingPartsCount = stats.upcomingPartsCount;
        watchedCount = stats.watchedCount;
        watchlistCount = stats.watchlistCount;
        collectedCount = stats.collectedCount;
        completionPercentage = stats.completionPercentage;
        upNextPart = stats.upNextPart;
      } else {
        watchedCount = group.watchedMovieIds.size;
        watchlistCount = group.watchlistMovieIds.size;
        collectedCount = new Set([...group.watchedMovieIds, ...group.watchlistMovieIds]).size;
        totalParts = Math.max(collectedCount, 1);
        releasedPartsCount = totalParts;
        upcomingPartsCount = 0;
        completionPercentage = totalParts > 0
          ? Math.min(100, Math.round((watchedCount / totalParts) * 100))
          : 0;
      }

      const fallbackPoster = cached?.poster_path
        ?? group.poster_path
        ?? effectiveParts?.find((p) => p.poster_path)?.poster_path
        ?? null;

      const fallbackBackdrop = cached?.backdrop_path
        ?? group.backdrop_path
        ?? effectiveParts?.find((p) => p.backdrop_path)?.backdrop_path
        ?? null;

      summaries.push({
        id: collectionId,
        name: cached?.name || group.name,
        overview: cached?.overview || group.overview,
        poster_path: fallbackPoster,
        backdrop_path: fallbackBackdrop,
        totalParts,
        releasedPartsCount,
        upcomingPartsCount,
        collectedCount,
        watchedCount,
        watchlistCount,
        completionPercentage,
        upNextPart,
        isUniverse: false,
        parts: effectiveParts
      });
    }

    // Sort: Universes first, then highest completion percentage, then alphabetical
    return summaries.sort((a, b) => {
      if (a.isUniverse && !b.isUniverse) return -1;
      if (!a.isUniverse && b.isUniverse) return 1;
      if (b.completionPercentage !== a.completionPercentage) {
        return b.completionPercentage - a.completionPercentage;
      }
      return a.name.localeCompare(b.name);
    });
  });

  /**
   * Imperatively gets collection details, using cache if available.
   */
  public async getCollectionMetadata(collectionId: number): Promise<CachedCollectionMeta | null> {
    const cached = this.metaCache.get(collectionId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached;
    }

    return this.fetchAndCacheCollection(collectionId);
  }

  private hydrateMemoryFromLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      const rawDismissed = localStorage.getItem(DISMISSED_FRANCHISES_KEY);
      if (rawDismissed) {
        const parsedDismissed = JSON.parse(rawDismissed);
        if (Array.isArray(parsedDismissed)) {
          for (const id of parsedDismissed) {
            if (id) this.dismissedIds.add(String(id));
          }
        }
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as CachedCollectionMeta;
            const collectionId = parseInt(key.substring(CACHE_PREFIX.length), 10);
            if (!isNaN(collectionId) && parsed && typeof parsed.totalParts === 'number') {
              this.metaCache.set(collectionId, parsed);
            }
          }
        }
      }
    } catch {
      // Safe fallback if localStorage is unavailable
    }
  }

  private syncMissingCollectionMetadata(
    watchlist: { id?: string; tmdbId?: number; mediaType: string; payload?: unknown }[],
    watched: { id?: string; tmdbId?: number; mediaType: string; payload?: unknown }[]
  ): void {
    const all = [...watchlist, ...watched];
    for (const item of all) {
      if (item.mediaType !== 'movie') continue;
      const payload = item.payload as Record<string, unknown> | undefined;
      const tmdbId = item.tmdbId || (payload?.['id'] as number | undefined);
      const docId = item.id || (tmdbId ? `movie_${tmdbId}` : undefined);
      if (!tmdbId || !docId) continue;

      // 1. If belongs_to_collection is undefined, enqueue movie for throttled franchise membership lookup
      if (payload && payload['belongs_to_collection'] === undefined) {
        if (!this.inFlightMovieLookups.has(tmdbId)) {
          this.inFlightMovieLookups.add(tmdbId);
          this.pendingMovieQueue.push({ tmdbId, docId });
        }
        continue;
      }

      // 2. If belongs_to_collection exists and has a collection ID, hydrate collection metadata
      const collection = payload?.['belongs_to_collection'] as { id: number } | null | undefined;
      if (!collection || !collection.id) continue;

      const cached = this.metaCache.get(collection.id);
      const isExpired = cached ? Date.now() - cached.cachedAt >= CACHE_TTL_MS : true;

      if ((!cached || isExpired) && !this.inFlightRequests.has(collection.id)) {
        this.fetchAndCacheCollection(collection.id).catch(() => {
          // Graceful ignore: offline or network issue
        });
      }
    }

    this.drainMovieLookupQueue();
  }

  private drainMovieLookupQueue(): void {
    while (this.activeMovieLookupWorkers < MAX_CONCURRENT_MOVIE_LOOKUPS && this.pendingMovieQueue.length > 0) {
      const next = this.pendingMovieQueue.shift();
      if (!next) break;
      this.activeMovieLookupWorkers++;
      this.resolveMovieFranchise(next.tmdbId, next.docId)
        .catch(() => {
          // Graceful ignore
        })
        .finally(() => {
          this.activeMovieLookupWorkers--;
          this.drainMovieLookupQueue();
        });
    }
  }

  private async resolveMovieFranchise(tmdbId: number, docId: string): Promise<void> {
    try {
      const details = await firstValueFrom(this.tmdbMovies.getMovieDetails(tmdbId));
      const belongs = details?.belongs_to_collection || null;

      // Patch the local RxDB document payload so we don't query TMDB again
      await this.storage.updateMediaPayload(docId, { belongs_to_collection: belongs });

      if (belongs && belongs.id) {
        await this.fetchAndCacheCollection(belongs.id);
      }
    } catch {
      // Graceful fallback
    } finally {
      this.inFlightMovieLookups.delete(tmdbId);
    }
  }

  private async fetchAndCacheCollection(collectionId: number): Promise<CachedCollectionMeta | null> {
    if (this.inFlightRequests.has(collectionId)) {
      return this.metaCache.get(collectionId) ?? null;
    }

    this.inFlightRequests.add(collectionId);
    try {
      const details: TmdbCollectionDetailDto = await firstValueFrom(
        this.tmdbCollections.getCollectionDetails(collectionId)
      );

      const parts: FranchisePart[] = (details.parts || []).map((p) => ({
        id: p.id,
        title: p.title,
        mediaType: 'movie',
        overview: p.overview,
        poster_path: p.poster_path,
        backdrop_path: p.backdrop_path,
        release_date: p.release_date,
        vote_average: p.vote_average,
        vote_count: p.vote_count
      }));

      const cached: CachedCollectionMeta = {
        cachedAt: Date.now(),
        name: details.name,
        overview: details.overview,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        totalParts: parts.length,
        parts
      };

      this.metaCache.set(collectionId, cached);

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(`${CACHE_PREFIX}${collectionId}`, JSON.stringify(cached));
        } catch {
          // Quota exceeded safe catch
        }
      }

      this.cacheRevision.update((r) => r + 1);
      return cached;
    } catch {
      return null;
    } finally {
      this.inFlightRequests.delete(collectionId);
    }
  }
}
