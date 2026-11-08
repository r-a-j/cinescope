import { Injectable, inject, signal, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { TvProgressService } from './tv-progress.service';
import { DiscoverPreferencesService } from './discover-preferences.service';
import { ContentDocType } from '../database/schemas/content.schema';

export interface TasteSeed {
  tmdbId: number;
  title: string;
  year?: string | undefined;
  mediaType: 'movie' | 'tv';
  genreIds: number[];
  genres: string[];
  originalLanguage: string;
  voteAverage: number;
  weight: number;
  source: 'watched' | 'completed_tv' | 'watchlist';
}

export interface GenrePairAffinity {
  pairKey: string; // e.g. "53,878" (comma-separated for TMDB AND discovery)
  genreIds: [number, number];
  label: string;
  score: number;
  mediaType: 'movie' | 'tv';
}

export interface PersonAffinity {
  id: number;
  name: string;
  department: 'Acting' | 'Directing' | string;
  weight: number;
}

export interface UserTasteProfile {
  fingerprint: string;
  totalInteractions: number;
  isColdStart: boolean;
  genreWeights: Record<number, number>;
  topMovieGenreIds: number[];
  topTvGenreIds: number[];
  topGenrePairs: GenrePairAffinity[];
  languageWeights: Record<string, number>;
  topLanguages: string[];
  decadeWeights: Record<number, number>;
  preferredRuntimeMin: number;
  topSeeds: TasteSeed[];
  watchlistSeeds: TasteSeed[];
  stalledTitles: string[];
  stalledKeys: Set<string>;
  dismissedKeys: Set<string>;
  personAffinities: PersonAffinity[];
  archetypes: string[];
}

const STORAGE_KEY_DISMISSED_RECS = 'cinescope_dismissed_recommendations_v1';

export const MOVIE_GENRE_LABELS: Readonly<Record<number, string>> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
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
  37: 'Western',
  10759: 'Action & Adventure',
  10765: 'Sci-Fi & Fantasy',
  10768: 'War & Politics'
};

@Injectable({
  providedIn: 'root'
})
export class TasteProfileService {
  private readonly storage = inject(StorageService);
  private readonly tvProgress = inject(TvProgressService);
  private readonly discoverPrefs = inject(DiscoverPreferencesService);

  private readonly dismissedIdsSignal = signal<Set<string>>(this.loadDismissedKeys());

  /**
   * Stage 1: Reactive User Taste DNA Vector computed in 0ms from local RxDB signals.
   * Combines time-decayed watched history, TV episode completion vs abandonment,
   * watchlist high-intent items, favorite artists/directors, and explicit taste preferences.
   */
  public readonly profile = computed<UserTasteProfile>(() => {
    const watchedDocs = this.storage.watchedItems();
    const watchlistDocs = this.storage.watchlistItems();
    const favPeopleDocs = this.storage.favoritePeople();
    const allTvProgress = this.tvProgress.allProgress();
    const prefLangs = this.discoverPrefs.preferredLanguages();
    const prefGenres = this.discoverPrefs.selectedGenreOptions();
    const dismissedKeys = this.dismissedIdsSignal();

    const genreWeights: Record<number, number> = {};
    const moviePairCounts = new Map<string, { ids: [number, number]; score: number }>();
    const tvPairCounts = new Map<string, { ids: [number, number]; score: number }>();
    const languageWeights: Record<string, number> = {};
    const decadeWeights: Record<number, number> = {};

    let runtimeWeightedSum = 0;
    let runtimeWeightTotal = 0;

    // 1. Seed baseline from explicit user preferences so cold-start users still have strong priors
    for (let idx = 0; idx < prefLangs.length; idx++) {
      const code = prefLangs[idx];
      languageWeights[code] = (languageWeights[code] || 0) + Math.max(2, 6 - idx);
    }

    for (const gOpt of prefGenres) {
      for (const idStr of gOpt.movieGenreIds.split('|')) {
        const gId = Number(idStr);
        if (gId > 0) genreWeights[gId] = (genreWeights[gId] || 0) + 3.0;
      }
      for (const idStr of gOpt.tvGenreIds.split('|')) {
        const gId = Number(idStr);
        if (gId > 0) genreWeights[gId] = (genreWeights[gId] || 0) + 2.5;
      }
    }

    // 2. Analyze TV Progress for completion boosts vs stalled/abandoned penalties
    const tvCompletionBonus = new Map<number, number>();
    const stalledTitles: string[] = [];
    const stalledKeys = new Set<string>();
    const nowMs = Date.now();

    for (const prog of allTvProgress) {
      const ratio =
        prog.totalEpisodes > 0 ? prog.watchedEpisodesCount / prog.totalEpisodes : 0;
      const daysSinceUpdate =
        (nowMs - (prog.lastWatchedAt || prog.updatedAt || nowMs)) / (1000 * 60 * 60 * 24);

      if (prog.isMarkedComplete || ratio >= 0.75) {
        tvCompletionBonus.set(prog.tmdbId, 1.85);
      } else if (ratio >= 0.35) {
        tvCompletionBonus.set(prog.tmdbId, 1.3);
      } else if (prog.watchedEpisodesCount <= 2 && daysSinceUpdate > 25) {
        // User tried 1-2 episodes and abandoned for > 25 days -> negative signal
        stalledTitles.push(prog.seriesTitle);
        stalledKeys.add(`tv_${prog.tmdbId}`);
        tvCompletionBonus.set(prog.tmdbId, 0.25);
      }
    }

    const extractDocGenres = (payload: Record<string, unknown>): number[] => {
      if (Array.isArray(payload['genre_ids'])) {
        return payload['genre_ids'].map(Number).filter((n) => n > 0);
      }
      if (Array.isArray(payload['genres'])) {
        return (payload['genres'] as (Record<string, unknown> | number)[])
          .map((g) => (typeof g === 'object' && g !== null ? Number(g['id'] || 0) : Number(g)))
          .filter((n) => n > 0);
      }
      return [];
    };

    const accumulateItem = (
      doc: ContentDocType,
      baseWeight: number,
      source: TasteSeed['source']
    ): TasteSeed | null => {
      const payload = (doc.payload || {}) as Record<string, unknown>;
      const title = String(payload['title'] || payload['name'] || '').trim();
      if (!title || !doc.tmdbId) return null;

      const timestampStr = doc.watchedAt || doc.addedAt;
      const itemTime = timestampStr ? new Date(timestampStr).getTime() : nowMs;
      const ageDays = Math.max(0, (nowMs - itemTime) / (1000 * 60 * 60 * 24));
      // Exponential half-life decay (~90 days half-life, floored at 0.45 so classics still count)
      const recencyMultiplier = Math.max(0.45, Math.exp(-ageDays / 120));

      const tvMult =
        doc.mediaType === 'tv' ? (tvCompletionBonus.get(doc.tmdbId) ?? 1.0) : 1.0;

      // Safety Policy: Strictly prohibit any AI analysis or recommendation seeding on 18+ adult content
      if (payload['adult'] === true || (doc as unknown as { adult?: boolean }).adult === true) {
        return null;
      }

      const voteAverage = Number(payload['vote_average'] || 7.0);
      // Skip poor-quality seeds (voteAverage < 5.5 and > 0) from anchoring recommendations
      if (voteAverage > 0 && voteAverage < 5.5 && source !== 'completed_tv') {
        return null;
      }
      const qualityMult = voteAverage >= 8.0 ? 1.25 : voteAverage >= 7.2 ? 1.1 : 1.0;

      const finalWeight = Number((baseWeight * recencyMultiplier * tvMult * qualityMult).toFixed(2));
      const genreIds = extractDocGenres(payload);

      let origLang = String(payload['original_language'] || '').trim().toLowerCase();
      if (!origLang) {
        // Try spoken_languages
        const spoken = payload['spoken_languages'] as { iso_639_1?: string }[] | undefined;
        if (Array.isArray(spoken) && spoken[0]?.iso_639_1) {
          origLang = spoken[0].iso_639_1.toLowerCase();
        } else {
          // Check script detection
          const hasIndicScript = /[\u0900-\u0D7F]/.test(title);
          const hasCjkScript = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/.test(title);
          if (hasIndicScript) {
            origLang = 'hi';
          } else if (hasCjkScript) {
            origLang = /[\uac00-\ud7af]/.test(title) ? 'ko' : 'ja';
          } else {
            // Check origin country
            const countries = payload['origin_country'] as string[] | undefined;
            if (Array.isArray(countries) && countries.includes('IN')) {
              origLang = prefLangs.find((l) => ['hi', 'ta', 'te', 'ml', 'bn', 'mr'].includes(l)) || 'hi';
            } else if (Array.isArray(countries) && countries.includes('KR')) {
              origLang = 'ko';
            } else if (Array.isArray(countries) && countries.includes('JP')) {
              origLang = 'ja';
            } else {
              // Default for Latin script titles: English
              origLang = 'en';
            }
          }
        }
      }

      const rawDate = String(payload['release_date'] || payload['first_air_date'] || '');
      const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : undefined;
      const yearNum = year ? Number(year) : 0;

      if (origLang && origLang.length >= 2) {
        languageWeights[origLang] = (languageWeights[origLang] || 0) + finalWeight;
      }

      if (yearNum >= 1950 && yearNum <= 2030) {
        const decade = Math.floor(yearNum / 10) * 10;
        decadeWeights[decade] = (decadeWeights[decade] || 0) + finalWeight;
      }

      const runtime = Number(payload['runtime'] || 0);
      if (doc.mediaType === 'movie' && runtime >= 60 && runtime <= 240) {
        runtimeWeightedSum += runtime * finalWeight;
        runtimeWeightTotal += finalWeight;
      }

      for (const gId of genreIds) {
        genreWeights[gId] = (genreWeights[gId] || 0) + finalWeight;
      }

      // Genre-pair co-occurrence matrix (captures intersections like Sci-Fi + Thriller)
      const sortedGenres = [...new Set(genreIds)].sort((a, b) => a - b);
      const targetPairMap = doc.mediaType === 'tv' ? tvPairCounts : moviePairCounts;
      for (let i = 0; i < sortedGenres.length; i++) {
        for (let j = i + 1; j < sortedGenres.length; j++) {
          const g1 = sortedGenres[i];
          const g2 = sortedGenres[j];
          const key = `${g1},${g2}`;
          const existing = targetPairMap.get(key);
          if (existing) {
            existing.score += finalWeight;
          } else {
            targetPairMap.set(key, { ids: [g1, g2], score: finalWeight });
          }
        }
      }

      return {
        tmdbId: doc.tmdbId,
        title,
        year,
        mediaType: doc.mediaType === 'tv' ? 'tv' : 'movie',
        genreIds,
        genres: genreIds.map((id) => MOVIE_GENRE_LABELS[id] || '').filter(Boolean),
        originalLanguage: origLang,
        voteAverage,
        weight: finalWeight,
        source
      };
    };

    const watchedSeeds: TasteSeed[] = [];
    for (const doc of watchedDocs) {
      if (doc.mediaType !== 'movie' && doc.mediaType !== 'tv') continue;
      if (stalledKeys.has(`${doc.mediaType}_${doc.tmdbId}`)) continue;
      const seed = accumulateItem(
        doc,
        2.2,
        doc.mediaType === 'tv' && (tvCompletionBonus.get(doc.tmdbId) ?? 1) > 1.5
          ? 'completed_tv'
          : 'watched'
      );
      if (seed) watchedSeeds.push(seed);
    }

    const watchlistSeeds: TasteSeed[] = [];
    for (const doc of watchlistDocs) {
      if (doc.mediaType !== 'movie' && doc.mediaType !== 'tv') continue;
      const seed = accumulateItem(doc, 1.35, 'watchlist');
      if (seed) watchlistSeeds.push(seed);
    }

    // Sort seeds by computed affinity weight so top seeds represent true favorites + recent loves
    watchedSeeds.sort((a, b) => b.weight - a.weight);
    watchlistSeeds.sort((a, b) => b.weight - a.weight);

    const topSeeds = this.selectDiverseSeeds(
      watchedSeeds.length > 0 ? watchedSeeds : watchlistSeeds,
      14
    );

    // Build top genre pairs
    const topGenrePairs: GenrePairAffinity[] = [];
    for (const [pairKey, val] of moviePairCounts.entries()) {
      const l1 = MOVIE_GENRE_LABELS[val.ids[0]] || '';
      const l2 = MOVIE_GENRE_LABELS[val.ids[1]] || '';
      if (l1 && l2) {
        topGenrePairs.push({
          pairKey,
          genreIds: val.ids,
          label: `${l1} × ${l2}`,
          score: Number(val.score.toFixed(2)),
          mediaType: 'movie'
        });
      }
    }
    for (const [pairKey, val] of tvPairCounts.entries()) {
      const l1 = MOVIE_GENRE_LABELS[val.ids[0]] || '';
      const l2 = MOVIE_GENRE_LABELS[val.ids[1]] || '';
      if (l1 && l2) {
        topGenrePairs.push({
          pairKey,
          genreIds: val.ids,
          label: `${l1} × ${l2}`,
          score: Number(val.score.toFixed(2)),
          mediaType: 'tv'
        });
      }
    }
    topGenrePairs.sort((a, b) => b.score - a.score);

    // Synthesize fallback genre pairs from explicit preferences if library has no pairs yet
    if (topGenrePairs.length === 0 && prefGenres.length >= 2) {
      const g1 = Number(prefGenres[0].movieGenreIds.split('|')[0]);
      const g2 = Number(prefGenres[1].movieGenreIds.split('|')[0]);
      if (g1 > 0 && g2 > 0 && g1 !== g2) {
        topGenrePairs.push({
          pairKey: `${g1},${g2}`,
          genreIds: [g1, g2],
          label: `${prefGenres[0].label} × ${prefGenres[1].label}`,
          score: 5.0,
          mediaType: 'movie'
        });
      }
    }

    const sortedGenres = Object.entries(genreWeights)
      .map(([id, w]) => ({ id: Number(id), weight: w }))
      .sort((a, b) => b.weight - a.weight);

    const tvValidGenreSet = new Set([10759, 16, 35, 80, 99, 18, 10751, 9648, 10765, 10768, 37]);
    const topMovieGenreIds = sortedGenres
      .filter((g) => g.id !== 10759 && g.id !== 10765 && g.id !== 10768)
      .slice(0, 5)
      .map((g) => g.id);

    const topTvGenreIds = sortedGenres
      .map((g) => {
        if (g.id === 878 || g.id === 14) return 10765;
        if (g.id === 28 || g.id === 12) return 10759;
        if (g.id === 53) return 9648;
        return g.id;
      })
      .filter((id, index, self) => tvValidGenreSet.has(id) && self.indexOf(id) === index)
      .slice(0, 4);

    const topLanguages = Object.entries(languageWeights)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code)
      .slice(0, 6);

    const personAffinities: PersonAffinity[] = favPeopleDocs
      .filter((doc) => {
        const p = (doc.payload || {}) as Record<string, unknown>;
        return p['adult'] !== true && (doc as unknown as { adult?: boolean }).adult !== true;
      })
      .slice(0, 12)
      .map((doc, idx) => {
        const p = (doc.payload || {}) as Record<string, unknown>;
        return {
          id: doc.tmdbId,
          name: String(p['name'] || `Artist #${doc.tmdbId}`),
          department: String(p['known_for_department'] || 'Acting'),
          weight: Math.max(2.0, 6.0 - idx * 0.4)
        };
      });

    const preferredRuntimeMin =
      runtimeWeightTotal > 0 ? Math.round(runtimeWeightedSum / runtimeWeightTotal) : 118;

    const archetypes = this.deriveArchetypes(
      genreWeights,
      languageWeights,
      allTvProgress.length,
      preferredRuntimeMin
    );

    const totalInteractions = watchedDocs.length + watchlistDocs.length + favPeopleDocs.length;
    const fingerprint = [
      topSeeds.slice(0, 5).map((s) => s.tmdbId).join('.'),
      topLanguages.slice(0, 3).join('.'),
      topMovieGenreIds.slice(0, 3).join('.'),
      totalInteractions
    ].join('|');

    return {
      fingerprint,
      totalInteractions,
      isColdStart: watchedDocs.length === 0 && watchlistDocs.length === 0,
      genreWeights,
      topMovieGenreIds,
      topTvGenreIds,
      topGenrePairs: topGenrePairs.slice(0, 6),
      languageWeights,
      topLanguages: topLanguages.length > 0 ? topLanguages : [...prefLangs],
      decadeWeights,
      preferredRuntimeMin,
      topSeeds,
      watchlistSeeds: watchlistSeeds.slice(0, 8),
      stalledTitles,
      stalledKeys,
      dismissedKeys,
      personAffinities,
      archetypes
    };
  });

  /**
   * Selects a diverse set of top seeds so a single franchise or language doesn't monopolize recommendations.
   */
  private selectDiverseSeeds(seeds: TasteSeed[], limit: number): TasteSeed[] {
    const selected: TasteSeed[] = [];
    const langCounts: Record<string, number> = {};
    const seenRoots = new Set<string>();

    const getRootTitle = (t: string): string => {
      return t
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .split(/[-:(]/)[0]
        .replace(/part\s+\d+|chapter\s+\d+|\d+$/i, '')
        .trim();
    };

    for (const seed of seeds) {
      if (selected.length >= limit) break;
      const langCount = langCounts[seed.originalLanguage] || 0;
      if (langCount >= Math.ceil(limit * 0.65) && seeds.length > limit) {
        continue;
      }

      // Avoid redundant sequels from the exact same franchise in top seed slots
      const root = getRootTitle(seed.title);
      if (root.length > 3 && seenRoots.has(root) && seeds.length > limit) {
        continue;
      }

      selected.push(seed);
      seenRoots.add(root);
      langCounts[seed.originalLanguage] = langCount + 1;
    }

    return selected.length > 0 ? selected : seeds.slice(0, limit);
  }

  private deriveArchetypes(
    genreWeights: Record<number, number>,
    languageWeights: Record<string, number>,
    trackedTvCount: number,
    avgRuntime: number
  ): string[] {
    const badges: string[] = [];
    const scifiMystery = (genreWeights[878] || 0) + (genreWeights[9648] || 0);
    const crimeThriller = (genreWeights[80] || 0) + (genreWeights[53] || 0);
    const actionAdv = (genreWeights[28] || 0) + (genreWeights[12] || 0);
    const dramaHistory = (genreWeights[18] || 0) + (genreWeights[36] || 0);

    if (scifiMystery >= 6) badges.push('Sci-Fi & Mystery Mindbender');
    if (crimeThriller >= 6) badges.push('Gritty Crime & Noir Architect');
    if (actionAdv >= 6) badges.push('High-Adrenaline Spectacle');
    if (dramaHistory >= 6) badges.push('Prestige Character Drama');

    const indianScore =
      (languageWeights['hi'] || 0) +
      (languageWeights['ml'] || 0) +
      (languageWeights['ta'] || 0) +
      (languageWeights['te'] || 0);
    if (indianScore >= 5) badges.push('Indian Cinema Connoisseur');
    if ((languageWeights['ko'] || 0) + (languageWeights['ja'] || 0) >= 4) {
      badges.push('Asian Thrillers & Anime Wave');
    }
    if (trackedTvCount >= 3) badges.push('Series Marathon Strategist');
    if (avgRuntime > 0 && avgRuntime <= 102) badges.push('Tight-Pacing Purist');

    return badges.length > 0 ? badges.slice(0, 4) : ['Eclectic Cinema Explorer'];
  }

  public dismissRecommendation(mediaType: 'movie' | 'tv', tmdbId: number | string): void {
    const key = `${mediaType}_${tmdbId}`;
    this.dismissedIdsSignal.update((prev) => {
      const next = new Set(prev);
      next.add(key);
      this.persistDismissedKeys(next);
      return next;
    });
  }

  public isDismissed(mediaType: 'movie' | 'tv', tmdbId: number | string): boolean {
    return this.dismissedIdsSignal().has(`${mediaType}_${tmdbId}`);
  }

  private loadDismissedKeys(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISMISSED_RECS);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return new Set<string>();
  }

  private persistDismissedKeys(keys: Set<string>): void {
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED_RECS, JSON.stringify([...keys].slice(-300)));
    } catch {
      // Ignore storage quota errors
    }
  }
}
