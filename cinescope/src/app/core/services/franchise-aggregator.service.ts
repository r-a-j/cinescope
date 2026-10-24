import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
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
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable({
  providedIn: 'root'
})
export class FranchiseAggregatorService {
  private storage = inject(StorageService);
  private tmdbCollections = inject(TmdbCollectionsService);
  private tmdbMovies = inject(TmdbMoviesService);

  private readonly metaCache = new Map<number, CachedCollectionMeta>();
  private readonly inFlightRequests = new Set<number>();
  private readonly inFlightMovieLookups = new Set<number>();
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
   * Reactive computed list of all franchises and universes derived from user library.
   */
  public readonly activeUserFranchises = computed<FranchiseCollectionSummary[]>(() => {
    // Read cacheRevision to recompute when new TMDB metadata finishes fetching
    this.cacheRevision();

    const watchlist = this.storage.watchlistItems();
    const watched = this.storage.watchedItems();
    const savedUniverses = this.storage.savedUniverses();

    const collectionMap = new Map<number, {
      id: number;
      name: string;
      poster_path?: string | null | undefined;
      backdrop_path?: string | null | undefined;
      watchlistMovieIds: Set<number>;
      watchedMovieIds: Set<number>;
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

    // 1. Process Movie Collections
    for (const [collectionId, group] of collectionMap.entries()) {
      const cached = this.metaCache.get(collectionId);
      const totalParts = cached?.totalParts ?? Math.max(group.watchedMovieIds.size + group.watchlistMovieIds.size, 1);
      const watchedCount = group.watchedMovieIds.size;
      const watchlistCount = group.watchlistMovieIds.size;
      const collectedCount = new Set([...group.watchedMovieIds, ...group.watchlistMovieIds]).size;
      const completionPercentage = totalParts > 0
        ? Math.min(100, Math.round((watchedCount / totalParts) * 100))
        : 0;

      summaries.push({
        id: collectionId,
        name: cached?.name || group.name,
        overview: cached?.overview,
        poster_path: cached?.poster_path ?? group.poster_path,
        backdrop_path: cached?.backdrop_path ?? group.backdrop_path,
        totalParts,
        collectedCount,
        watchedCount,
        watchlistCount,
        completionPercentage,
        isUniverse: false,
        parts: cached?.parts
      });
    }

    // 2. Process AI-Ascended Universes from RxDB
    const watchedMediaKeys = this.storage.watchedMediaKeys();
    const watchlistDocs = this.storage.watchlistItems();
    const watchlistMediaKeys = new Set(watchlistDocs.map((d) => d.id));

    for (const uniDoc of savedUniverses) {
      const uniPayload = uniDoc.payload as unknown as FranchiseCollectionSummary | undefined;
      if (!uniPayload) continue;

      const universeId = uniPayload.universeId || String(uniDoc.tmdbId);
      const canonParts = uniPayload.parts || [];
      const totalParts = canonParts.length || uniPayload.totalParts || 1;

      let watchedCount = 0;
      let watchlistCount = 0;

      for (const part of canonParts) {
        const type = part.mediaType || 'movie';
        const key = `${type}_${part.id}`;
        if (watchedMediaKeys.has(key)) {
          watchedCount++;
        } else if (watchlistMediaKeys.has(key)) {
          watchlistCount++;
        }
      }

      const collectedCount = watchedCount + watchlistCount;
      const completionPercentage = totalParts > 0
        ? Math.min(100, Math.round((watchedCount / totalParts) * 100))
        : 0;

      const numericId = typeof uniPayload.id === 'number' ? uniPayload.id : (typeof uniDoc.tmdbId === 'number' ? uniDoc.tmdbId : null);
      if (numericId && collectionMap.has(numericId)) {
        continue;
      }

      const isUniverse = Boolean(uniPayload.isUniverse ?? (uniDoc.lists ? uniDoc.lists.includes('universe') : true));

      summaries.push({
        id: universeId,
        name: uniPayload.name,
        overview: uniPayload.overview,
        poster_path: uniPayload.poster_path,
        backdrop_path: uniPayload.backdrop_path,
        totalParts,
        collectedCount,
        watchedCount,
        watchlistCount,
        completionPercentage,
        isUniverse,
        universeId,
        parentUniverseTitle: uniPayload.parentUniverseTitle,
        connectionInsight: uniPayload.connectionInsight,
        parts: canonParts,
        siblingFranchises: uniPayload.siblingFranchises
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

      // 1. If belongs_to_collection is undefined, the movie has not been inspected for franchise membership
      if (payload && payload['belongs_to_collection'] === undefined) {
        if (!this.inFlightMovieLookups.has(tmdbId)) {
          this.resolveMovieFranchise(tmdbId, docId).catch(() => {
            // Graceful ignore
          });
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
  }

  private async resolveMovieFranchise(tmdbId: number, docId: string): Promise<void> {
    this.inFlightMovieLookups.add(tmdbId);
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
