import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TasteProfileService, MOVIE_GENRE_LABELS } from './taste-profile.service';
import { StorageService, checkMediaReleaseStatus, getLocalTodayIso } from './storage.service';
import {
  DiscoverPreferencesService,
  AiTasteCachedLane
} from './discover-preferences.service';
import { TmdbDiscoverService } from './tmdb-discover.service';
import { TmdbMoviesService } from './tmdb-movies.service';
import { TmdbTvService } from './tmdb-tv.service';
import { TmdbSearchService } from './tmdb-search.service';
import { CollectionQueryContext } from './collection-loader.service';
import { TmdbDiscoverMovieParamsDto } from '../dtos/discover/discover-movie-params.dto';
import { TmdbDiscoverTvParamsDto } from '../dtos/discover/discover-tv-params.dto';
import { TmdbMovieListItemDto } from '../dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { ContentDocType } from '../database/schemas/content.schema';
import { resolveMediaImageUrl } from '../constants/api.constants';
import { CineMatchMood, ContextualHook } from '../../features/movies/movies.models';

export interface AiCuratedPickDto {
  title: string;
  year?: number;
  mediaType: 'movie' | 'tv';
  reason: string;
}

export interface AiDiscoverGraphDto {
  with_genres?: string;
  without_genres?: string;
  keywords?: string[];
  with_original_language?: string;
  person_name?: string;
  vote_average_gte?: number;
  vote_count_gte?: number;
  release_year_gte?: number;
  release_year_lte?: number;
  runtime_lte?: number;
  sort_by?: 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc';
}

export interface AiRecommendationLaneDto {
  id: string;
  title: string;
  subtitle: string;
  mediaType: 'movie' | 'tv';
  curatedPicks: AiCuratedPickDto[];
  discoverGraph: AiDiscoverGraphDto;
}

export interface RecommendResponseDto {
  lanes: AiRecommendationLaneDto[];
  degraded?: boolean;
}

export interface ScoredRecommendation {
  matchPercent: number; // 55 - 99
  rawScore: number;
  hook: ContextualHook;
}

@Injectable({
  providedIn: 'root'
})
export class RecommendationEngineService {
  private readonly http = inject(HttpClient);
  private readonly tasteProfile = inject(TasteProfileService);
  private readonly storage = inject(StorageService);
  private readonly discoverPrefs = inject(DiscoverPreferencesService);
  private readonly discoverService = inject(TmdbDiscoverService);
  private readonly moviesService = inject(TmdbMoviesService);
  private readonly tvService = inject(TmdbTvService);
  private readonly searchService = inject(TmdbSearchService);

  private readonly recommendApiUrl = `${environment.apiUrl}/recommend`;

  /**
   * Stage 3: Deterministic Multi-Objective CineMatch Scorer & Explainability Engine.
   * Computes a 55–99% match score and a personalized "Why This Matches You" hook for any item.
   */
  public scoreMediaPayload(
    payload: Record<string, unknown> | undefined | null,
    mediaType: 'movie' | 'tv' = 'movie',
    options?: {
      addedAt?: string | undefined;
      activeMood?: CineMatchMood | undefined;
      preferQuickRuntime?: boolean | undefined;
      aiReason?: string | undefined;
    }
  ): ScoredRecommendation {
    if (!payload) {
      return {
        matchPercent: 78,
        rawScore: 0.78,
        hook: {
          emoji: '🍿',
          badge: '78% Match',
          text: 'Handpicked for your cinema library'
        }
      };
    }

    const profile = this.tasteProfile.profile();
    const voteAverage = Number(payload['vote_average'] || 0);
    const voteCount = Number(payload['vote_count'] || 150);
    const runtime = Number(payload['runtime'] || 0);
    const origLang = String(payload['original_language'] || '').toLowerCase();

    // 1. Bayesian Weighted Quality Score (prevents 1-vote 10.0 outliers from beating real classics)
    const m = 120;
    const C = 6.9;
    const bayesianRating =
      voteAverage > 0 ? (voteCount / (voteCount + m)) * voteAverage + (m / (voteCount + m)) * C : 6.9;
    const qualityNorm = Math.min(1, Math.max(0.3, (bayesianRating - 5.0) / 4.2));

    // 2. Genre & Genre-Pair Co-occurrence Affinity
    let genreIds: number[] = [];
    if (Array.isArray(payload['genre_ids'])) {
      genreIds = payload['genre_ids'].map(Number).filter((n) => n > 0);
    } else if (Array.isArray(payload['genres'])) {
      genreIds = (payload['genres'] as (Record<string, unknown> | number)[])
        .map((g) => (typeof g === 'object' && g !== null ? Number(g['id'] || 0) : Number(g)))
        .filter((n) => n > 0);
    }

    const maxGenreWeight = Math.max(1, ...Object.values(profile.genreWeights));
    let genreAffinitySum = 0;
    const matchedGenreLabels: string[] = [];

    for (const gId of genreIds) {
      const w = profile.genreWeights[gId] || 0;
      if (w > 0) {
        genreAffinitySum += w / maxGenreWeight;
        const label = MOVIE_GENRE_LABELS[gId];
        if (label) matchedGenreLabels.push(label);
      }
    }
    const genreNorm =
      genreIds.length > 0
        ? Math.min(1, genreAffinitySum / Math.min(2.2, genreIds.length))
        : 0.5;

    // Bonus if item matches one of the user's top Genre-Pair intersections
    let matchedPairLabel: string | null = null;
    for (const pair of profile.topGenrePairs) {
      if (
        pair.mediaType === mediaType &&
        genreIds.includes(pair.genreIds[0]) &&
        genreIds.includes(pair.genreIds[1])
      ) {
        matchedPairLabel = pair.label;
        break;
      }
    }
    const pairBonus = matchedPairLabel ? 0.14 : 0;

    // 3. Language Affinity
    const maxLangWeight = Math.max(1, ...Object.values(profile.languageWeights));
    const langWeight = origLang ? profile.languageWeights[origLang] || 0 : 0;
    const langNorm =
      langWeight > 0
        ? Math.min(1, 0.55 + 0.45 * (langWeight / maxLangWeight))
        : profile.topLanguages.includes(origLang)
        ? 0.8
        : 0.4;

    // 4. Pacing & Mood Context Bonus
    let contextBonus = 0;
    if (options?.preferQuickRuntime && runtime > 0 && runtime <= 100) {
      contextBonus += 0.12;
    } else if (
      runtime > 0 &&
      Math.abs(runtime - profile.preferredRuntimeMin) <= 22
    ) {
      contextBonus += 0.06;
    }

    if (options?.activeMood && options.activeMood !== 'all') {
      contextBonus += 0.08;
    }

    // Combine weighted multi-objective score
    const rawScore = Math.min(
      0.99,
      Math.max(
        0.55,
        0.38 * genreNorm +
          0.28 * qualityNorm +
          0.2 * langNorm +
          pairBonus +
          contextBonus
      )
    );
    const matchPercent = Math.round(rawScore * 100);

    // Build explainable Personalized Hook
    if (options?.aiReason) {
      return {
        matchPercent: Math.max(88, matchPercent),
        rawScore,
        hook: {
          emoji: '✨',
          badge: `${Math.max(88, matchPercent)}% AI Match`,
          text: options.aiReason
        }
      };
    }

    if (matchedPairLabel) {
      const seedMatch = profile.topSeeds.find(
        (s) =>
          s.mediaType === mediaType &&
          s.genreIds.includes(genreIds[0]) &&
          (genreIds.length < 2 || s.genreIds.includes(genreIds[1]))
      );
      return {
        matchPercent,
        rawScore,
        hook: {
          emoji: '🧬',
          badge: `${matchPercent}% Taste Match`,
          text: seedMatch
            ? `Shares ${matchedPairLabel} DNA with ${seedMatch.title}`
            : `Matches your ${matchedPairLabel} signature`
        }
      };
    }

    if (voteAverage >= 8.2) {
      return {
        matchPercent,
        rawScore,
        hook: {
          emoji: '🏆',
          badge: `${matchPercent}% Match • Acclaimed`,
          text: `★ ${voteAverage.toFixed(1)} rating • Top-tier ${matchedGenreLabels[0] || 'cinema'} for your palate`
        }
      };
    }

    if (runtime > 0 && runtime <= 95) {
      return {
        matchPercent,
        rawScore,
        hook: {
          emoji: '⏱️',
          badge: `${matchPercent}% Match • Tight Pace`,
          text: `${runtime}m runtime • Zero-filler momentum for tonight`
        }
      };
    }

    const daysAgo = options?.addedAt
      ? Math.floor((Date.now() - new Date(options.addedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    if (daysAgo >= 45) {
      return {
        matchPercent,
        rawScore,
        hook: {
          emoji: '⏳',
          badge: `${matchPercent}% Match • Vault Gem`,
          text: `Saved ${daysAgo}d ago • Strong ${matchedGenreLabels.slice(0, 2).join(' & ') || 'taste'} fit`
        }
      };
    }

    return {
      matchPercent,
      rawScore,
      hook: {
        emoji: '🎯',
        badge: `${matchPercent}% Taste Match`,
        text:
          matchedGenreLabels.length > 0
            ? `Aligned with your ${matchedGenreLabels.slice(0, 2).join(' & ')} profile`
            : 'Tailored to your viewing history'
      }
    };
  }

  /**
   * Re-ranks a list of SwimlaneItems by the user's Taste DNA profile, filtering out watched
   * and dismissed items, and enriching subtitles with Match % or AI explanations when appropriate.
   */
  public rankSwimlaneItems(
    items: SwimlaneItem[],
    options?: {
      hideWatched?: boolean;
      attachMatchSubtitle?: boolean;
      excludeIds?: Set<string | number>;
      seenKeys?: Set<string>;
      allowUnreleased?: boolean;
    }
  ): SwimlaneItem[] {
    const hideWatched = options?.hideWatched ?? this.discoverPrefs.hideWatchedInDiscover();
    const watchedKeys = this.storage.watchedMediaKeys();
    const allowAdult = this.storage.allowAdultContent();
    const profile = this.tasteProfile.profile();
    const seen = new Set<string | number>();
    const allowUnreleased = options?.allowUnreleased ?? false;

    const scored: { item: SwimlaneItem; score: number }[] = [];

    for (const item of items) {
      if (!item || !item.id || seen.has(item.id)) continue;
      if (options?.excludeIds?.has(item.id)) continue;

      const mediaType: 'movie' | 'tv' = item.mediaType === 'tv' ? 'tv' : 'movie';
      const mediaKey = `${mediaType}_${item.id}`;
      if (options?.seenKeys?.has(mediaKey)) continue;
      if (hideWatched && watchedKeys.has(mediaKey)) continue;
      if (profile.dismissedKeys.has(mediaKey) || profile.stalledKeys.has(mediaKey)) continue;

      const payload = (item.payload || {}) as Record<string, unknown>;

      // Adult content guard: drop 18+ adult titles when family-safe filtering is active
      if (!allowAdult && (payload['adult'] === true || (item as unknown as { adult?: boolean }).adult === true)) {
        continue;
      }

      // Release date guard: exclude unreleased future titles unless explicitly permitted
      if (!allowUnreleased) {
        const releaseCheck = checkMediaReleaseStatus(payload);
        if (!releaseCheck.isReleased) continue;
      }

      seen.add(item.id);

      const aiReason = payload['aiReason'] as string | undefined;
      const evalResult = this.scoreMediaPayload(payload, mediaType, { aiReason });

      const enrichedItem: SwimlaneItem = {
        ...item,
        subtitle:
          item.subtitle ||
          (options?.attachMatchSubtitle
            ? aiReason
              ? `${evalResult.matchPercent}% • ${aiReason}`
              : `${evalResult.matchPercent}% Match`
            : item.subtitle),
        payload: {
          ...payload,
          matchPercent: evalResult.matchPercent,
          matchBadge: evalResult.hook.badge,
          matchReason: evalResult.hook.text
        }
      };

      scored.push({
        item: enrichedItem,
        score: evalResult.rawScore + (aiReason ? 0.15 : 0)
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item);
  }

  /**
   * Ranks a pool of ContentDocType (e.g. Watchlist Movies in CineMatch) by Taste DNA & Time Context.
   */
  public rankWatchlistDocs(
    docs: ContentDocType[],
    activeMood: CineMatchMood = 'all',
    preferQuickRuntime = false
  ): ContentDocType[] {
    return [...docs]
      .map((doc) => ({
        doc,
        score: this.scoreMediaPayload(
          doc.payload as Record<string, unknown>,
          doc.mediaType === 'tv' ? 'tv' : 'movie',
          {
            addedAt: doc.addedAt,
            activeMood,
            preferQuickRuntime
          }
        ).rawScore
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.doc);
  }

  /**
   * Stage 2: Calls `/api/recommend` with the user's full Taste DNA Profile and hydrates both
   * Gemini's exact curated titles AND the companion TMDB Discover execution graphs.
   */
  public async fetchAndHydrateAiLanes(
    langPipe: string,
    forceRefresh = false
  ): Promise<
    {
      id: string;
      title: string;
      items: SwimlaneItem[];
      queryContext: CollectionQueryContext;
    }[]
  > {
    const profile = this.tasteProfile.profile();
    let cachedPayload = forceRefresh ? null : this.discoverPrefs.getValidAiTasteCache();

    if (!cachedPayload) {
      try {
        const excludeTitles = [
          ...profile.topSeeds.map((s) => s.title),
          ...profile.watchlistSeeds.map((s) => s.title),
          ...profile.stalledTitles
        ].slice(0, 35);

        const requestBody = {
          mode: 'for-you' as const,
          topSeeds: profile.topSeeds.slice(0, 12).map((s) => ({
            title: s.title,
            year: s.year,
            mediaType: s.mediaType,
            genres: s.genres.slice(0, 3),
            language: s.originalLanguage,
            weight: s.weight
          })),
          watchlistSeeds: profile.watchlistSeeds.slice(0, 6).map((s) => ({
            title: s.title,
            year: s.year,
            mediaType: s.mediaType,
            genres: s.genres.slice(0, 2),
            language: s.originalLanguage
          })),
          stalledTitles: profile.stalledTitles.slice(0, 5),
          favoritePeople: profile.personAffinities.slice(0, 6).map((p) => p.name),
          preferredLanguages: profile.topLanguages.slice(0, 5),
          topGenrePairs: profile.topGenrePairs.slice(0, 5).map((p) => p.label),
          archetypes: profile.archetypes,
          preferredRuntimeMin: profile.preferredRuntimeMin,
          excludeTitles,
          models: environment.geminiModels
        };

        const response = await firstValueFrom(
          this.http.post<RecommendResponseDto>(this.recommendApiUrl, requestBody)
        );

        const rawLanes = response?.lanes || [];
        const builtLanes: AiTasteCachedLane[] = [];

        for (let idx = 0; idx < rawLanes.length; idx++) {
          const lane = rawLanes[idx];
          const graph = lane.discoverGraph || {};

          // Resolve optional person_name and keywords in parallel
          const [castId, keywordPipe] = await Promise.all([
            this.resolvePersonId(graph.person_name),
            this.resolveKeywordPipe(graph.keywords)
          ]);

          // Hydrate Gemini's exact curatedPicks against TMDB search in parallel
          const curatedItems = await this.hydrateCuratedPicks(
            lane.curatedPicks || [],
            lane.mediaType
          );

          const effectiveLang = graph.with_original_language || langPipe || 'hi|en';

          if (lane.mediaType === 'tv') {
            const tvParams: TmdbDiscoverTvParamsDto = {
              with_original_language: effectiveLang,
              ...(graph.with_genres ? { with_genres: graph.with_genres } : {}),
              ...(graph.without_genres ? { without_genres: graph.without_genres } : {}),
              ...(keywordPipe ? { with_keywords: keywordPipe } : {}),
              'first_air_date.lte': graph.release_year_lte
                ? `${graph.release_year_lte}-12-31`
                : getLocalTodayIso(),
              include_adult: false,
              'vote_average.gte': graph.vote_average_gte ?? 7.0,
              'vote_count.gte': graph.vote_count_gte ?? 20,
              sort_by: graph.sort_by === 'vote_average.desc' ? 'vote_average.desc' : 'popularity.desc'
            };
            builtLanes.push({
              id: lane.id || `ai-taste-tv-${idx}`,
              title: `AI PULSE: ${lane.title.replace(/^AI (CURATED|PULSE):\s*/i, '')}`,
              subtitle: lane.subtitle,
              mediaType: 'tv',
              tvParams,
              curatedItems
            });
          } else {
            const movieParams: TmdbDiscoverMovieParamsDto = {
              ...(!castId && effectiveLang ? { with_original_language: effectiveLang } : {}),
              ...(castId ? { with_cast: castId } : {}),
              ...(graph.with_genres ? { with_genres: graph.with_genres } : {}),
              ...(graph.without_genres ? { without_genres: graph.without_genres } : {}),
              ...(keywordPipe ? { with_keywords: keywordPipe } : {}),
              ...(graph.release_year_gte
                ? { 'primary_release_date.gte': `${graph.release_year_gte}-01-01` }
                : {}),
              'primary_release_date.lte': graph.release_year_lte
                ? `${graph.release_year_lte}-12-31`
                : getLocalTodayIso(),
              include_adult: false,
              ...(graph.runtime_lte ? { 'with_runtime.lte': graph.runtime_lte } : {}),
              'vote_average.gte': graph.vote_average_gte ?? 6.8,
              'vote_count.gte': graph.vote_count_gte ?? 25,
              sort_by: graph.sort_by || 'popularity.desc'
            };
            builtLanes.push({
              id: lane.id || `ai-taste-movie-${idx}`,
              title: `AI PULSE: ${lane.title.replace(/^AI (CURATED|PULSE):\s*/i, '')}`,
              subtitle: lane.subtitle,
              mediaType: 'movie',
              movieParams,
              curatedItems
            });
          }
        }

        if (builtLanes.length > 0) {
          cachedPayload = this.discoverPrefs.saveAiTasteCache(builtLanes, profile.fingerprint);
        }
      } catch {
        cachedPayload = this.discoverPrefs.aiTasteCache();
      }
    }

    if (!cachedPayload || cachedPayload.lanes.length === 0) {
      return [];
    }

    const hydratedSections: {
      id: string;
      title: string;
      items: SwimlaneItem[];
      queryContext: CollectionQueryContext;
    }[] = [];

    const aiLaneSeenKeys = new Set<string>();

    for (const lane of cachedPayload.lanes) {
      try {
        const seededCurated = lane.curatedItems || [];
        let discoverMapped: SwimlaneItem[] = [];
        if (lane.mediaType === 'tv' && lane.tvParams) {
          const res = await firstValueFrom(this.discoverService.discoverTv(lane.tvParams));
          discoverMapped = this.mapTvToSwimlane(res.results || []);
        } else if (lane.movieParams) {
          const res = await firstValueFrom(this.discoverService.discoverMovies(lane.movieParams));
          discoverMapped = this.mapMoviesToSwimlane(res.results || []);
        }

        const ranked = this.rankSwimlaneItems([...seededCurated, ...discoverMapped], {
          attachMatchSubtitle: true,
          seenKeys: aiLaneSeenKeys
        });

        if (ranked.length >= 3) {
          for (const it of ranked) {
            aiLaneSeenKeys.add(`${it.mediaType}_${it.id}`);
          }
          const queryContext: CollectionQueryContext =
            lane.mediaType === 'tv' && lane.tvParams
              ? { type: 'discover_tv', tvParams: lane.tvParams }
              : { type: 'discover_movies', movieParams: lane.movieParams || {} };

          hydratedSections.push({
            id: lane.id,
            title: lane.title,
            items: ranked,
            queryContext
          });
        }
      } catch {
        // Skip failed lane
      }
    }

    return hydratedSections;
  }

  /**
   * Stage 2 Multi-Seed Graph Channel: Aggregates TMDB `/recommendations` across the user's
   * top weighted seeds and re-ranks them by overlap frequency + Taste DNA score.
   */
  public async buildMultiSeedCollaborativeSection(): Promise<{
    id: string;
    title: string;
    items: SwimlaneItem[];
    queryContext: CollectionQueryContext;
  } | null> {
    const profile = this.tasteProfile.profile();
    const seeds = profile.topSeeds.slice(0, 4);
    if (seeds.length < 2) return null;

    try {
      const seedTmdbIds = new Set(seeds.map((s) => s.tmdbId));
      const resultsBySeed = await Promise.all(
        seeds.map(async (seed) => {
          try {
            if (seed.mediaType === 'tv') {
              const res = await firstValueFrom(
                this.tvService.getTvRecommendations(seed.tmdbId, 'en-US', 1)
              );
              return this.mapTvToSwimlane(res.results || []);
            } else {
              const res = await firstValueFrom(
                this.moviesService.getMovieRecommendations(seed.tmdbId, 'en-US', 1)
              );
              return this.mapMoviesToSwimlane(res.results || []);
            }
          } catch {
            return [] as SwimlaneItem[];
          }
        })
      );

      // Verify at least 2 distinct seeds yielded recommendations
      const nonZeroSeeds = resultsBySeed.filter((r) => r.length > 0);
      if (nonZeroSeeds.length < 2) {
        return null;
      }

      // Boost items that are co-recommended by multiple seeds
      const freqMap = new Map<string, { item: SwimlaneItem; count: number }>();
      for (const list of resultsBySeed) {
        for (const item of list) {
          if (seedTmdbIds.has(Number(item.id))) continue;
          const key = `${item.mediaType}_${item.id}`;
          const existing = freqMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            freqMap.set(key, { item, count: 1 });
          }
        }
      }

      const merged = [...freqMap.values()]
        .sort((a, b) => b.count - a.count)
        .map((entry) => entry.item);

      const ranked = this.rankSwimlaneItems(merged, { attachMatchSubtitle: true }).slice(0, 20);
      if (ranked.length < 4) return null;

      const leadSeed = seeds[0];
      return {
        id: 'taste-dna-multi-seed-synthesis',
        title: `TASTE DNA SYNTHESIS (${seeds.slice(0, 2).map((s) => s.title.toUpperCase()).join(' × ')})`,
        items: ranked,
        queryContext: {
          type: 'recommendations',
          id: leadSeed.tmdbId,
          mediaType: leadSeed.mediaType
        }
      };
    } catch {
      return null;
    }
  }

  private async resolvePersonId(personName?: string): Promise<string | undefined> {
    if (!personName || !personName.trim()) return undefined;
    try {
      const pRes = await firstValueFrom(this.searchService.searchPerson(personName.trim(), 1));
      if (pRes.results && pRes.results.length > 0) {
        return String(pRes.results[0].id);
      }
    } catch {
      // Ignore lookup failure
    }
    return undefined;
  }

  private async resolveKeywordPipe(keywords?: string[]): Promise<string | undefined> {
    if (!Array.isArray(keywords) || keywords.length === 0) return undefined;
    try {
      const kwIds = await Promise.all(
        keywords.slice(0, 3).map(async (kw) => {
          const kwRes = await firstValueFrom(this.searchService.searchKeywords(kw, 1));
          return kwRes.results?.[0]?.id ? String(kwRes.results[0].id) : null;
        })
      );
      const valid = kwIds.filter((k): k is string => !!k);
      return valid.length > 0 ? valid.join('|') : undefined;
    } catch {
      return undefined;
    }
  }

  private async hydrateCuratedPicks(
    picks: AiCuratedPickDto[],
    defaultMediaType: 'movie' | 'tv'
  ): Promise<SwimlaneItem[]> {
    if (!Array.isArray(picks) || picks.length === 0) return [];
    const allowAdult = this.storage.allowAdultContent();

    const resolved = await Promise.all(
      picks.slice(0, 6).map(async (pick) => {
        try {
          const type = pick.mediaType || defaultMediaType;
          if (type === 'tv') {
            const res = await firstValueFrom(
              this.searchService.searchTvShows(pick.title, 1, 'en-US', false, pick.year)
            );
            const match = (res.results || []).find((r) => r.poster_path && (allowAdult || !r.adult));
            if (!match) return null;
            return {
              id: match.id,
              mediaType: 'tv' as const,
              title: match.name,
              subtitle: pick.reason,
              posterUrl: resolveMediaImageUrl(match.poster_path, 'w500'),
              bookmarkState: 'none' as const,
              payload: {
                ...(match as unknown as Record<string, unknown>),
                aiReason: pick.reason
              }
            } as SwimlaneItem;
          } else {
            const res = await firstValueFrom(
              this.searchService.searchMovies(
                pick.title,
                1,
                'en-US',
                false,
                pick.year ? String(pick.year) : undefined
              )
            );
            const match = (res.results || []).find((r) => r.poster_path && (allowAdult || !r.adult));
            if (!match) return null;
            return {
              id: match.id,
              mediaType: 'movie' as const,
              title: match.title,
              subtitle: pick.reason,
              posterUrl: resolveMediaImageUrl(match.poster_path, 'w500'),
              bookmarkState: 'none' as const,
              payload: {
                ...(match as unknown as Record<string, unknown>),
                aiReason: pick.reason
              }
            } as SwimlaneItem;
          }
        } catch {
          return null;
        }
      })
    );

    return resolved.filter((item): item is SwimlaneItem => item !== null);
  }

  private mapMoviesToSwimlane(items: TmdbMovieListItemDto[]): SwimlaneItem[] {
    const allowAdult = this.storage.allowAdultContent();
    return (items || [])
      .filter((item) => item.poster_path && (allowAdult || !item.adult))
      .map((item) => ({
        id: item.id,
        mediaType: 'movie' as const,
        title: item.title,
        posterUrl: resolveMediaImageUrl(item.poster_path, 'w500'),
        bookmarkState: 'none' as const,
        payload: item as unknown as Record<string, unknown>
      }));
  }

  private mapTvToSwimlane(items: TmdbTvListItemDto[]): SwimlaneItem[] {
    const allowAdult = this.storage.allowAdultContent();
    return (items || [])
      .filter((item) => item.poster_path && (allowAdult || !item.adult))
      .map((item) => ({
        id: item.id,
        mediaType: 'tv' as const,
        title: item.name,
        posterUrl: resolveMediaImageUrl(item.poster_path, 'w500'),
        bookmarkState: 'none' as const,
        payload: item as unknown as Record<string, unknown>
      }));
  }
}
