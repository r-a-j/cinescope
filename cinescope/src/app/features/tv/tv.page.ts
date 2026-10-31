import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  playOutline,
  checkmarkCircle,
  checkmarkDoneOutline,
  timeOutline,
  calendarOutline,
  sparkles,
  tvOutline,
  filmOutline,
  bookmarkOutline,
  albumsOutline,
  arrowForwardOutline,
  chevronForwardOutline,
  swapVerticalOutline,
  refreshOutline,
  star,
  flameOutline,
  hourglassOutline
} from 'ionicons/icons';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';
import { EmptyStateComponent } from 'src/app/shared/components/empty-state/empty-state.component';
import { EpisodeDetailModalComponent } from 'src/app/shared/components/episode-detail-modal/episode-detail-modal.component';
import { TvProgressService, AirRadarItem } from 'src/app/core/services/tv-progress.service';
import { StorageService } from 'src/app/core/services/storage.service';
import { TmdbTvService } from 'src/app/core/services/tmdb-tv.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { MediaMetadataService } from 'src/app/core/services/media-metadata.service';
import { PosterCacheService } from 'src/app/core/services/poster-cache.service';
import { resolveMediaImageUrl } from 'src/app/core/constants/api.constants';
import { TmdbTvDetailDto } from 'src/app/core/dtos/tv/tv-detail.dto';
import { firstValueFrom } from 'rxjs';

export type BingeFilterMode = 'all' | 'quick' | 'weekend' | 'long' | 'unstarted';

export function isQuickBite(card: { totalSeasons: number; totalEpisodes: number }): boolean {
  return card.totalEpisodes > 0 && card.totalEpisodes <= 10;
}

export function isWeekendBinge(card: { totalSeasons: number; totalEpisodes: number }): boolean {
  return card.totalSeasons <= 2 && card.totalEpisodes > 10 && card.totalEpisodes <= 24;
}

export function isLongHaul(card: { totalSeasons: number; totalEpisodes: number }): boolean {
  return card.totalSeasons >= 3 || card.totalEpisodes > 24;
}

export interface TvGridCardVm {
  id: number;
  title: string;
  posterUrl: string;
  backdropUrl?: string | undefined;
  totalSeasons: number;
  totalEpisodes: number;
  watchedEpisodesCount: number;
  percentage: number;
  isCompleted: boolean;
  isUnstarted: boolean;
  upNextSeason?: number | undefined;
  upNextEpisode?: number | undefined;
  upNextTitle?: string | undefined;
  status?: string | undefined;
}

@Component({
  selector: 'app-tv',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
    HeaderComponent,
    EmptyStateComponent,
    EpisodeDetailModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tv.page.html',
  styleUrls: ['./tv.page.scss'],
})
export class TvPage {
  public readonly tvProgress = inject(TvProgressService);
  public readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private readonly tmdbTv = inject(TmdbTvService);
  private readonly toast = inject(ToastService);
  public readonly mediaMetadata = inject(MediaMetadataService);
  public readonly posterCache = inject(PosterCacheService);

  public readonly activeBingeFilter = signal<BingeFilterMode>('all');
  public readonly selectedHeroId = signal<number | null>(null);
  public readonly isRefreshing = signal<boolean>(false);
  public readonly heroEpisodeStillUrl = signal<string | null>(null);
  public readonly loadedImages = signal<Record<string, boolean>>({});

  // Quick Episode Lookup Modal State
  public readonly isEpisodeModalOpen = signal<boolean>(false);
  public readonly modalSeriesId = signal<number | undefined>(undefined);
  public readonly modalSeasonNumber = signal<number>(1);
  public readonly modalEpisodeNumber = signal<number>(1);
  public readonly modalSeriesTitle = signal<string | undefined>(undefined);
  public readonly modalSeriesBackdrop = signal<string | undefined>(undefined);
  public readonly modalTotalEpisodesInSeason = signal<number | undefined>(undefined);

  /**
   * Primary backdrop for the hero stage:
   * Prioritizes the landscape episode still of the up-next episode,
   * falling back to the series-level backdrop if the still is not available.
   */
  public readonly heroBackdropUrl = computed<string | undefined>(() => {
    return this.heroEpisodeStillUrl() ?? this.heroSeries()?.backdropUrl;
  });

  /**
   * Hero showcase series (defaults to first in-progress series, or first watchlist series).
   */
  public readonly heroSeries = computed<TvGridCardVm | null>(() => {
    const list = this.allDisplayCards();
    if (list.length === 0) return null;

    const chosenId = this.selectedHeroId();
    if (chosenId) {
      const match = list.find((c) => c.id === chosenId);
      if (match) return match;
    }

    // Default to the first in-progress show, or first unstarted show
    const inProgress = list.find((c) => !c.isCompleted && !c.isUnstarted);
    if (inProgress) return inProgress;

    const unstarted = list.find((c) => c.isUnstarted);
    if (unstarted) return unstarted;

    return list[0];
  });

  /**
   * Combined and deduplicated list of all trackable TV series in library.
   * Includes active tracking progress, watchlist series, and previously watched series.
   */
  public readonly allDisplayCards = computed<TvGridCardVm[]>(() => {
    const cards: TvGridCardVm[] = [];
    const seenIds = new Set<number>();

    // 1. Add all series with active progress records
    for (const p of this.tvProgress.allProgress()) {
      seenIds.add(p.tmdbId);
      const isCompleted = p.isMarkedComplete
        ? (p.unwatchedEpisodes?.length ?? 0) === 0
        : p.totalEpisodes > 0 && p.watchedEpisodesCount >= p.totalEpisodes;
      const isUnstarted = p.watchedEpisodesCount === 0 && !p.isMarkedComplete;
      const pct = isCompleted
        ? 100
        : p.totalEpisodes > 0
        ? Math.min(100, Math.round((p.watchedEpisodesCount / p.totalEpisodes) * 100))
        : 0;

      let upNextSeason: number | undefined;
      let upNextEpisode: number | undefined;
      if (!isCompleted) {
        const nextEp = this.tvProgress.getUpNextEpisode(p.tmdbId);
        upNextSeason = nextEp?.seasonNumber;
        upNextEpisode = nextEp?.episodeNumber;
      }

      cards.push({
        id: p.tmdbId,
        title: p.seriesTitle,
        posterUrl: resolveMediaImageUrl(p.posterPath, 'w342'),
        backdropUrl: p.backdropPath ? resolveMediaImageUrl(p.backdropPath, 'w780') : undefined,
        totalSeasons: p.totalSeasons,
        totalEpisodes: p.totalEpisodes,
        watchedEpisodesCount: p.watchedEpisodesCount,
        percentage: pct,
        isCompleted,
        isUnstarted,
        upNextSeason,
        upNextEpisode,
        upNextTitle: p.lastWatchedEpisodeTitle,
        status: p.status
      });
    }

    // 2. Add Watchlist TV series that don't have progress yet
    for (const w of this.tvProgress.watchlistReadyToStart()) {
      if (seenIds.has(w.tmdbId)) continue;
      seenIds.add(w.tmdbId);
      const upNext = this.tvProgress.getUpNextEpisode(w.tmdbId);

      cards.push({
        id: w.tmdbId,
        title: w.title,
        posterUrl: resolveMediaImageUrl(w.posterPath, 'w342'),
        backdropUrl: w.backdropPath ? resolveMediaImageUrl(w.backdropPath, 'w780') : undefined,
        totalSeasons: w.totalSeasons ?? 1,
        totalEpisodes: w.totalEpisodes ?? 0,
        watchedEpisodesCount: 0,
        percentage: 0,
        isCompleted: false,
        isUnstarted: true,
        upNextSeason: upNext?.seasonNumber,
        upNextEpisode: upNext?.episodeNumber,
        upNextTitle: undefined
      });
    }

    // 3. Add Watched TV series from storage that don't have an explicit progress doc yet
    // In CineScope, previously watched series default to 100% completed
    for (const item of this.storage.watchedItems()) {
      if (item.mediaType !== 'tv') continue;
      if (seenIds.has(item.tmdbId)) continue;
      seenIds.add(item.tmdbId);

      const payload = (item.payload ?? {}) as Partial<TmdbTvDetailDto>;
      const title = String(payload.name || (payload['title'] as string | undefined) || `Series #${item.tmdbId}`);
      const totalSeasons = typeof payload.number_of_seasons === 'number' ? payload.number_of_seasons : 1;
      const totalEpisodes = typeof payload.number_of_episodes === 'number' ? payload.number_of_episodes : 0;

      cards.push({
        id: item.tmdbId,
        title,
        posterUrl: resolveMediaImageUrl(payload.poster_path, 'w342'),
        backdropUrl: payload.backdrop_path ? resolveMediaImageUrl(payload.backdrop_path, 'w780') : undefined,
        totalSeasons,
        totalEpisodes,
        watchedEpisodesCount: totalEpisodes,
        percentage: 100,
        isCompleted: true,
        isUnstarted: false,
        upNextSeason: undefined,
        upNextEpisode: undefined,
        upNextTitle: undefined,
        status: payload.status
      });
    }

    return cards;
  });

  /**
   * Filtered grid based on the user's Binge Sizer filter.
   */
  public readonly filteredCards = computed<TvGridCardVm[]>(() => {
    const list = this.allDisplayCards();
    const filter = this.activeBingeFilter();

    switch (filter) {
      case 'quick':
        return list.filter(isQuickBite);
      case 'weekend':
        return list.filter(isWeekendBinge);
      case 'long':
        return list.filter(isLongHaul);
      case 'unstarted':
        return list.filter((c) => c.isUnstarted);
      case 'all':
      default:
        return list;
    }
  });

  /**
   * Live count metrics for each Binge Sizer category.
   */
  public readonly filterCounts = computed(() => {
    const list = this.allDisplayCards();
    let quick = 0;
    let weekend = 0;
    let long = 0;
    let unstarted = 0;

    for (const c of list) {
      if (c.isUnstarted) unstarted++;
      if (isQuickBite(c)) quick++;
      if (isWeekendBinge(c)) weekend++;
      if (isLongHaul(c)) long++;
    }

    return { all: list.length, quick, weekend, long, unstarted };
  });

  public readonly hasAnyTvContent = computed<boolean>(() => {
    return this.allDisplayCards().length > 0;
  });

  constructor() {
    addIcons({
      playOutline,
      checkmarkCircle,
      checkmarkDoneOutline,
      timeOutline,
      calendarOutline,
      sparkles,
      tvOutline,
      filmOutline,
      bookmarkOutline,
      albumsOutline,
      arrowForwardOutline,
      chevronForwardOutline,
      swapVerticalOutline,
      refreshOutline,
      star,
      flameOutline,
      hourglassOutline
    });

    // Centralized idle healing & poster prewarming
    effect(() => {
      const cards = this.allDisplayCards();
      const urlsToWarm: string[] = [];
      for (const c of cards) {
        if (c.posterUrl) urlsToWarm.push(c.posterUrl);
        if (c.backdropUrl) urlsToWarm.push(c.backdropUrl);
      }
      if (urlsToWarm.length > 0) {
        this.posterCache.prewarmUrls(urlsToWarm);
      }

      const needsHealing = cards
        .filter((c) => {
          const cachedDoc = this.storage.getCachedDoc(c.id, 'tv');
          const payload = cachedDoc?.payload as { seasons?: { season_number: number; episode_count: number }[] } | undefined;
          const cachedBreakdown = payload?.seasons?.some(
            (season) => season.season_number > 0 && season.episode_count > 0
          ) ?? false;
          const progressBreakdown = this.tvProgress.getSeriesProgress(c.id)?.seasonEpisodeCounts?.length ?? 0;
          const hasSeasonBreakdown = cachedBreakdown || progressBreakdown > 0;
          return !c.posterUrl || c.posterUrl.includes('placeholder') || c.totalEpisodes === 0 || !hasSeasonBreakdown;
        })
        .slice(0, 10)
        .map((c) => ({ tmdbId: c.id, mediaType: 'tv' as const }));

      if (needsHealing.length > 0) {
        this.mediaMetadata.queueBackgroundHealing(needsHealing);
      }
    });

    // Reactive episode still loader for hero command center
    effect(() => {
      const hero = this.heroSeries();
      if (!hero || hero.isCompleted || !hero.upNextSeason || !hero.upNextEpisode) {
        this.heroEpisodeStillUrl.set(null);
        return;
      }

      const seriesId = hero.id;
      const season = hero.upNextSeason;
      const episode = hero.upNextEpisode;

      void this.mediaMetadata.getEpisodeStillUrl(seriesId, season, episode).then((still) => {
        const currentHero = this.heroSeries();
        if (
          currentHero &&
          currentHero.id === seriesId &&
          currentHero.upNextSeason === season &&
          currentHero.upNextEpisode === episode
        ) {
          if (still) {
            this.posterCache.prewarmUrls([still]);
          }
          this.heroEpisodeStillUrl.set(still);
        }
      });
    });
  }

  public isImageLoaded(url: string | null | undefined): boolean {
    if (!url) return false;
    return Boolean(this.loadedImages()[url]) || this.posterCache.isWarm(url);
  }

  public onImageLoad(event: Event, url: string | null | undefined): void {
    if (!url) return;
    const img = event.target as HTMLImageElement | null;
    this.posterCache.markLoaded(url, img ?? undefined);
    this.loadedImages.update((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }

  public resolveRadarPoster(posterPath: string | null | undefined): string {
    return resolveMediaImageUrl(posterPath, 'w185');
  }

  public onImageError(event: Event, tmdbId: number): void {
    this.mediaMetadata.handleImageError(event, tmdbId, 'tv');
    const img = event.target as HTMLImageElement | null;
    if (img?.src) {
      this.loadedImages.update((prev) => ({ ...prev, [img.src]: true }));
    }
  }

  public onBackdropError(event: Event, tmdbId?: number): void {
    const img = event.target as HTMLImageElement;
    const hero = this.heroSeries();

    // If current image was the episode still, fallback to series backdrop
    if (this.heroEpisodeStillUrl()) {
      this.heroEpisodeStillUrl.set(null);
      if (hero?.backdropUrl) {
        img.src = hero.backdropUrl;
        return;
      }
    }

    // If series backdrop also failed or unavailable, hide img to show gradient stage
    img.style.display = 'none';
    if (tmdbId) {
      void this.mediaMetadata.healMediaMetadata(tmdbId, 'tv');
    }
  }

  public setFilter(mode: BingeFilterMode): void {
    this.activeBingeFilter.set(mode);
  }

  public selectHero(id: number): void {
    this.heroEpisodeStillUrl.set(null);
    this.selectedHeroId.set(id);
  }

  public async onMarkNextEpisodeWatched(event: Event, card: TvGridCardVm): Promise<void> {
    event.stopPropagation();
    const season = card.upNextSeason ?? 1;
    const episode = card.upNextEpisode ?? 1;

    await this.tvProgress.markEpisodeWatched(card.id, season, episode, {
      title: card.title,
      totalSeasons: card.totalSeasons,
      totalEpisodes: card.totalEpisodes,
      status: card.status
    });

    void this.toast.presentSuccess(`Marked S${season} E${episode} watched for ${card.title}`, 2200);
  }

  public openShowDetail(tmdbId: number): void {
    void this.router.navigate(['/media', 'tv', tmdbId]);
  }

  public openEpisodeGuide(hero?: TvGridCardVm | null): void {
    if (!hero) return;
    this.modalSeriesId.set(hero.id);
    this.modalSeasonNumber.set(hero.upNextSeason ?? 1);
    this.modalEpisodeNumber.set(hero.upNextEpisode ?? 1);
    this.modalSeriesTitle.set(hero.title);
    this.modalSeriesBackdrop.set(hero.backdropUrl);
    this.modalTotalEpisodesInSeason.set(undefined);
    this.isEpisodeModalOpen.set(true);
  }

  public openAirRadarEpisode(item: AirRadarItem): void {
    this.modalSeriesId.set(item.tmdbId);
    this.modalSeasonNumber.set(item.seasonNumber);
    this.modalEpisodeNumber.set(item.episodeNumber);
    this.modalSeriesTitle.set(item.seriesTitle);
    this.modalSeriesBackdrop.set(undefined);
    this.modalTotalEpisodesInSeason.set(undefined);
    this.isEpisodeModalOpen.set(true);
  }

  public closeEpisodeModal(): void {
    this.isEpisodeModalOpen.set(false);
  }

  public onModalEpisodeChange(event: { seasonNumber: number; episodeNumber: number }): void {
    this.modalSeasonNumber.set(event.seasonNumber);
    this.modalEpisodeNumber.set(event.episodeNumber);
  }

  public navigateToDiscover(): void {
    void this.router.navigate(['/tabs/discover']);
  }

  public async onPullRefresh(event: RefresherCustomEvent): Promise<void> {
    this.isRefreshing.set(true);
    try {
      const tracked = [...this.tvProgress.currentlyWatching(), ...this.tvProgress.completedSeries()];
      const uniqueSeries = Array.from(new Map(tracked.map((series) => [series.tmdbId, series])).values());

      for (let index = 0; index < uniqueSeries.length; index += 3) {
        const batch = uniqueSeries.slice(index, index + 3);
        const results = await Promise.allSettled(batch.map(async (series) => {
          const detail = await firstValueFrom(this.tmdbTv.getTvShowDetails(series.tmdbId));
          if (detail) {
            await this.tvProgress.syncSeriesMeta(detail);
          }
        }));
        results.forEach((result, batchIndex) => {
          if (result.status === 'rejected') {
            console.warn(`[TvPage] Failed to refresh TV metadata for ${batch[batchIndex].tmdbId}:`, result.reason);
          }
        });
      }
    } finally {
      this.isRefreshing.set(false);
      event.target.complete();
    }
  }

  public formatRadarLabel(item: AirRadarItem): string {
    if (item.daysUntil === 0) return 'AIRS TODAY';
    if (item.daysUntil === 1) return 'TOMORROW';
    if (item.daysUntil === -1) return 'AIRED YESTERDAY';
    if (item.daysUntil < 0) return `${Math.abs(item.daysUntil)} DAYS AGO`;
    return `IN ${item.daysUntil} DAYS`;
  }
}
