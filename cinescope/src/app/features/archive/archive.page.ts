import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bookmarkOutline, checkmarkDoneCircleOutline, checkmarkCircle, playOutline, sparkles, closeOutline, heart, heartOutline, trophyOutline, albumsOutline, trashOutline, ribbonOutline, searchOutline, arrowForwardOutline, chevronDownOutline, chevronUpOutline, swapVerticalOutline, star, videocamOutline, personOutline } from 'ionicons/icons';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PosterCardComponent, BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { StorageService, PersonTopCreditSummary, extractPersonCreditMetadata } from '../../core/services/storage.service';
import { TmdbPeopleService } from '../../core/services/tmdb-people.service';
import { ToastService } from '../../core/services/toast.service';
import { FranchiseAggregatorService } from '../../core/services/franchise-aggregator.service';
import { FranchiseCollectionSummary } from '../../core/models/franchise.model';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { TmdbPersonCombinedCreditsResponseDto } from '../../core/dtos/people/person-combined-credits.dto';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

const INITIAL_CHUNK_SIZE = 40;
const SCROLL_CHUNK_STEP = 40;

export type PeopleFilterType = 'all' | 'actors' | 'directors' | 'in_progress' | 'milestones';
export type PeopleSortType = 'most_watched' | 'completion' | 'recent' | 'alpha';

export interface ArchiveCardVm {
  id: string;
  doc: ContentDocType;
  title: string;
  posterUrl: string;
  metaSubtitle: string;
}

export interface FavoritePersonCardVm {
  id: number;
  docId: string;
  addedAt: string;
  name: string;
  department: string;
  departmentBadge: string;
  isDirector: boolean;
  knownForSubtitle: string;
  profileUrl: string;
  watched: number;
  watchlist: number;
  total: number;
  percent: number;
  rankBadge: string | null;
  upNextCredit: PersonTopCreditSummary | null;
  isHydrating: boolean;
}

@Component({
  selector: 'app-archive',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonToolbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    HeaderComponent,
    EmptyStateComponent,
    PosterCardComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './archive.page.html',
  styleUrls: ['./archive.page.scss']
})
export class ArchivePage implements AfterViewInit {
  @ViewChild(IonContent, { static: false }) private content?: IonContent;
  private scrollEl: HTMLElement | null = null;
  private scrollPositions: Record<'watchlist' | 'watched' | 'franchises' | 'people', number> = {
    watchlist: 0,
    watched: 0,
    franchises: 0,
    people: 0
  };

  public storage = inject(StorageService);
  public franchiseAggregator = inject(FranchiseAggregatorService);
  private peopleService = inject(TmdbPeopleService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  public activeTab = signal<'watchlist' | 'watched' | 'franchises' | 'people'>('watchlist');
  public watchlistMediaFilter = signal<'all' | 'movie' | 'tv'>('all');
  public watchedMediaFilter = signal<'all' | 'movie' | 'tv'>('all');
  public franchiseFilter = signal<'all' | 'in_progress' | 'completed' | 'universes'>('all');
  public peopleFilter = signal<PeopleFilterType>('all');
  public peopleSort = signal<PeopleSortType>('most_watched');

  private hydratingPersonIds = signal<Set<number>>(new Set());
  private attemptedHydrationIds = new Set<number>();

  public userFranchises = computed<FranchiseCollectionSummary[]>(() => {
    return this.franchiseAggregator.activeUserFranchises();
  });

  public franchiseCounts = computed(() => {
    const all = this.userFranchises();
    let inProgress = 0;
    let completed = 0;
    let universes = 0;
    for (const f of all) {
      if (f.isUniverse) universes++;
      if (f.completionPercentage >= 100 && f.totalParts > 0) {
        completed++;
      } else if (f.watchedCount > 0 || f.watchlistCount > 0) {
        inProgress++;
      }
    }
    return { all: all.length, inProgress, completed, universes };
  });

  public filteredFranchises = computed<FranchiseCollectionSummary[]>(() => {
    const list = this.userFranchises();
    const filter = this.franchiseFilter();
    if (filter === 'universes') {
      return list.filter((f) => Boolean(f.isUniverse));
    }
    if (filter === 'completed') {
      return list.filter((f) => f.completionPercentage >= 100 && f.totalParts > 0);
    }
    if (filter === 'in_progress') {
      return list.filter((f) => f.completionPercentage < 100);
    }
    return list;
  });

  public currentMediaFilter = computed<'all' | 'movie' | 'tv'>(() => {
    return this.activeTab() === 'watchlist'
      ? this.watchlistMediaFilter()
      : this.watchedMediaFilter();
  });
  public fadePhase = signal<'a' | 'b'>('a');

  public visibleWatchlistLimit = signal<number>(INITIAL_CHUNK_SIZE);
  public visibleWatchedLimit = signal<number>(INITIAL_CHUNK_SIZE);

  public activeTabItems = computed<ContentDocType[]>(() => {
    return this.activeTab() === 'watchlist'
      ? this.storage.watchlistItems()
      : this.storage.watchedItems();
  });

  public movieCount = computed<number>(() => {
    return this.activeTabItems().filter((item) => item.mediaType === 'movie').length;
  });

  public tvCount = computed<number>(() => {
    return this.activeTabItems().filter((item) => item.mediaType === 'tv').length;
  });

  public filteredWatchlist = computed<ArchiveCardVm[]>(() => {
    const items = this.storage.watchlistItems();
    const filter = this.watchlistMediaFilter();
    const filtered = filter === 'all' ? items : items.filter((item) => item.mediaType === filter);
    return filtered.map((doc) => this.toCardVm(doc));
  });

  public filteredWatched = computed<ArchiveCardVm[]>(() => {
    const items = this.storage.watchedItems();
    const filter = this.watchedMediaFilter();
    const filtered = filter === 'all' ? items : items.filter((item) => item.mediaType === filter);
    return filtered.map((doc) => this.toCardVm(doc));
  });

  public visibleWatchlist = computed<ArchiveCardVm[]>(() => {
    return this.filteredWatchlist().slice(0, this.visibleWatchlistLimit());
  });

  public visibleWatched = computed<ArchiveCardVm[]>(() => {
    return this.filteredWatched().slice(0, this.visibleWatchedLimit());
  });

  public favoritePeopleCards = computed<FavoritePersonCardVm[]>(() => {
    const docs = this.storage.favoritePeople();
    const watchedKeys = this.storage.watchedMediaKeys();
    const hydratingSet = this.hydratingPersonIds();

    return docs.map((doc) => {
      const payload = (doc.payload ?? {}) as Record<string, unknown>;
      const name = String(payload['name'] || `Artist #${doc.tmdbId}`);
      const rawPath = (payload['profile_path'] || payload['posterUrl']) as string | undefined;
      const profileUrl = resolveMediaImageUrl(rawPath, 'w342');
      const department = String(payload['known_for_department'] || 'Acting');
      const isDirector = /directing/i.test(department);
      const departmentBadge = isDirector
        ? 'DIRECTOR'
        : /writing/i.test(department)
          ? 'WRITER'
          : /production/i.test(department)
            ? 'PRODUCER'
            : 'ACTOR';

      const creditIds = Array.isArray(payload['credit_ids']) ? (payload['credit_ids'] as string[]) : [];
      const topCredits = Array.isArray(payload['top_credits'])
        ? (payload['top_credits'] as PersonTopCreditSummary[])
        : [];
      const rawKnownFor = String(payload['known_for_titles'] || '').trim();
      const fallbackKnownFor = topCredits
        .slice(0, 3)
        .map((c) => c.title)
        .filter(Boolean)
        .join(' • ');
      const knownForSubtitle = rawKnownFor || fallbackKnownFor;

      // Track progress against core filmography when available so percentages are motivating and accurate
      const topKeys = topCredits.map((c) => `${c.mediaType}_${c.id}`);
      const trackingKeys = topKeys.length >= 5 ? topKeys : creditIds;
      const progress = this.storage.getPersonProgress(trackingKeys);

      // Pick the highest-priority released credit that the user has NOT watched yet
      let upNextCredit: PersonTopCreditSummary | null = null;
      for (const tc of topCredits) {
        if (!tc?.id || !tc?.mediaType) continue;
        const key = `${tc.mediaType}_${tc.id}`;
        if (!watchedKeys.has(key)) {
          upNextCredit = tc;
          break;
        }
      }

      let rankBadge: string | null = null;
      if (progress.total > 0 && progress.percent >= 100) {
        rankBadge = 'COMPLETIONIST';
      } else if (progress.percent >= 50 || progress.watched >= 8) {
        rankBadge = 'SUPERFAN';
      } else if (progress.watched >= 3) {
        rankBadge = 'MARATHONER';
      }

      return {
        id: doc.tmdbId,
        docId: doc.id,
        addedAt: doc.addedAt || '',
        name,
        department,
        departmentBadge,
        isDirector,
        knownForSubtitle,
        profileUrl,
        watched: progress.watched,
        watchlist: progress.watchlist,
        total: progress.total,
        percent: progress.percent,
        rankBadge,
        upNextCredit,
        isHydrating: hydratingSet.has(doc.tmdbId)
      };
    });
  });

  public peopleCounts = computed(() => {
    const all = this.favoritePeopleCards();
    let actors = 0;
    let directors = 0;
    let inProgress = 0;
    let milestones = 0;

    for (const p of all) {
      if (p.isDirector) {
        directors++;
      } else {
        actors++;
      }
      if (p.watched > 0 && p.percent < 100) {
        inProgress++;
      }
      if (p.percent >= 50 || p.watched >= 5) {
        milestones++;
      }
    }

    return {
      all: all.length,
      actors,
      directors,
      inProgress,
      milestones
    };
  });

  public peopleSortLabel = computed<string>(() => {
    const mode = this.peopleSort();
    if (mode === 'most_watched') return 'Most Watched';
    if (mode === 'completion') return 'Completion %';
    if (mode === 'recent') return 'Recently Added';
    return 'Name A–Z';
  });

  public filteredPeopleCards = computed<FavoritePersonCardVm[]>(() => {
    const list = this.favoritePeopleCards();
    const filter = this.peopleFilter();
    const sort = this.peopleSort();

    const filtered = list.filter((p) => {
      if (filter === 'actors') return !p.isDirector;
      if (filter === 'directors') return p.isDirector;
      if (filter === 'in_progress') return p.watched > 0 && p.percent < 100;
      if (filter === 'milestones') return p.percent >= 50 || p.watched >= 5;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'most_watched') {
        if (b.watched !== a.watched) return b.watched - a.watched;
        return b.percent - a.percent;
      }
      if (sort === 'completion') {
        if (b.percent !== a.percent) return b.percent - a.percent;
        return b.watched - a.watched;
      }
      if (sort === 'alpha') {
        return a.name.localeCompare(b.name);
      }
      return (b.addedAt || '').localeCompare(a.addedAt || '');
    });
  });

  public hasMoreItems = computed<boolean>(() => {
    if (this.activeTab() === 'people' || this.activeTab() === 'franchises') return false;
    return this.activeTab() === 'watchlist'
      ? this.visibleWatchlist().length < this.filteredWatchlist().length
      : this.visibleWatched().length < this.filteredWatched().length;
  });

  public expandedUniverseIds = signal<Set<string | number>>(new Set());

  public isUniverseExpanded(id: string | number): boolean {
    return this.expandedUniverseIds().has(id);
  }

  public toggleExpandUniverseSagas(event: Event, id: string | number): void {
    event.stopPropagation();
    this.expandedUniverseIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  public openSubFranchise(event: Event, sub: FranchiseCollectionSummary): void {
    event.stopPropagation();
    this.onFranchiseClick(sub);
  }

  constructor() {
    addIcons({
      bookmarkOutline, checkmarkDoneCircleOutline, checkmarkCircle, playOutline, sparkles, closeOutline, heart, heartOutline, trophyOutline,
      albumsOutline, trashOutline, ribbonOutline, searchOutline, arrowForwardOutline, chevronDownOutline, chevronUpOutline,
      swapVerticalOutline, star, videocamOutline, personOutline
    });

    // Automatically backfill filmography credits & top credits for any favorite artist missing them
    effect(() => {
      const docs = this.storage.favoritePeople();
      for (const doc of docs) {
        const p = (doc.payload ?? {}) as Record<string, unknown>;
        const creditIds = Array.isArray(p['credit_ids']) ? (p['credit_ids'] as string[]) : [];
        const topCredits = Array.isArray(p['top_credits']) ? (p['top_credits'] as unknown[]) : [];
        if ((creditIds.length === 0 || topCredits.length === 0) && !this.attemptedHydrationIds.has(doc.tmdbId)) {
          this.attemptedHydrationIds.add(doc.tmdbId);
          void this.hydratePersonCreditsInBackground(doc.tmdbId);
        }
      }
    });
  }

  private async hydratePersonCreditsInBackground(personId: number): Promise<void> {
    if (!personId || Number.isNaN(personId)) return;
    this.hydratingPersonIds.update((prev) => {
      const next = new Set(prev);
      next.add(personId);
      return next;
    });

    try {
      const details = await firstValueFrom(
        this.peopleService.getPersonDetails(personId, 'combined_credits')
      );
      if (!this.storage.isPersonFavorite(personId)) return;
      const combined = (details?.['combined_credits'] as TmdbPersonCombinedCreditsResponseDto | undefined) ?? null;
      const extracted = extractPersonCreditMetadata(combined);
      if (extracted.creditIds.length > 0) {
        await this.storage.updateFavoritePersonCredits(personId, extracted.creditIds, {
          topCredits: extracted.topCredits,
          knownForTitles: extracted.knownForTitles,
          department: details.known_for_department || undefined,
          profilePath: details.profile_path
        });
      }
    } catch (err) {
      console.warn('[ArchivePage] Failed to hydrate favorite person credits:', err);
    } finally {
      this.hydratingPersonIds.update((prev) => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    }
  }

  public ionViewWillEnter(): void {
    const tourParam = this.route.snapshot.queryParamMap.get('tour') ?? '';
    const tabParam = this.route.snapshot.queryParamMap.get('tab') ?? '';
    if (['franchise', 'franchise-merge'].includes(tourParam)) {
      this.activeTab.set('franchises');
    } else if (tabParam === 'people' || tabParam === 'franchises' || tabParam === 'watched' || tabParam === 'watchlist') {
      this.activeTab.set(tabParam);
    }
    this.triggerFadeAnimation();
  }

  public async ngAfterViewInit(): Promise<void> {
    this.scrollEl = await this.content?.getScrollElement() ?? null;
  }

  public async onTabChange(event: Event): Promise<void> {
    const val = (event as CustomEvent).detail?.value as 'watchlist' | 'watched' | 'franchises' | 'people' | undefined;
    if (val === 'watchlist' || val === 'watched' || val === 'franchises' || val === 'people') {
      if (val === this.activeTab()) return;

      const prev = this.activeTab();
      if (!this.scrollEl && this.content) {
        this.scrollEl = await this.content.getScrollElement();
      }
      if (this.scrollEl) {
        this.scrollPositions[prev] = this.scrollEl.scrollTop;
      }

      this.activeTab.set(val);
      this.triggerFadeAnimation();

      const targetY = this.scrollPositions[val] || 0;
      if (targetY === 0 && this.scrollEl) {
        this.scrollEl.scrollTop = 0;
      }
      requestAnimationFrame(() => {
        if (this.scrollEl) {
          this.scrollEl.scrollTop = targetY;
        } else {
          void this.content?.scrollToPoint(0, targetY, 0);
        }
      });

      const segmentEl = (event as CustomEvent).target as HTMLElement | null;
      const activeBtn = segmentEl?.querySelector(`ion-segment-button[value="${val}"]`);
      activeBtn?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  public setMediaFilter(filter: 'all' | 'movie' | 'tv'): void {
    const tab = this.activeTab();
    if (tab === 'watchlist') {
      if (this.watchlistMediaFilter() !== filter) {
        this.watchlistMediaFilter.set(filter);
        this.visibleWatchlistLimit.set(INITIAL_CHUNK_SIZE);
        this.triggerFadeAnimation();
        this.scrollPositions['watchlist'] = 0;
        if (this.scrollEl) {
          this.scrollEl.scrollTop = 0;
        } else {
          void this.content?.scrollToTop(0);
        }
      }
    } else if (tab === 'watched') {
      if (this.watchedMediaFilter() !== filter) {
        this.watchedMediaFilter.set(filter);
        this.visibleWatchedLimit.set(INITIAL_CHUNK_SIZE);
        this.triggerFadeAnimation();
        this.scrollPositions['watched'] = 0;
        if (this.scrollEl) {
          this.scrollEl.scrollTop = 0;
        } else {
          void this.content?.scrollToTop(0);
        }
      }
    }
  }

  private triggerFadeAnimation(): void {
    this.fadePhase.update((current) => (current === 'a' ? 'b' : 'a'));
  }

  public onLoadMore(event: Event): void {
    if (this.activeTab() === 'watchlist') {
      this.visibleWatchlistLimit.update((current) => current + SCROLL_CHUNK_STEP);
    } else {
      this.visibleWatchedLimit.update((current) => current + SCROLL_CHUNK_STEP);
    }
    const target = event.target as HTMLIonInfiniteScrollElement | null;
    if (target) {
      void target.complete();
    }
  }

  public onOpenDetail(vm: ArchiveCardVm): void {
    if (vm.doc.mediaType === 'person') return;
    void this.router.navigate(['/media', vm.doc.mediaType, vm.doc.tmdbId], {
      state: {
        preview: {
          id: vm.doc.tmdbId,
          mediaType: vm.doc.mediaType,
          title: vm.title,
          posterUrl: vm.posterUrl
        }
      }
    });
  }

  private toCardVm(doc: ContentDocType): ArchiveCardVm {
    const payload = doc.payload as Record<string, unknown> | undefined;
    const title = String(payload?.['title'] || payload?.['name'] || `#${doc.tmdbId}`);
    const rawPath = (payload?.['poster_path'] || payload?.['profile_path'] || payload?.['posterUrl']) as string | undefined;
    const posterUrl = resolveMediaImageUrl(rawPath, 'w342');

    const rawDate = String(payload?.['release_date'] || payload?.['first_air_date'] || '');
    const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : '';
    const rating = Number(payload?.['vote_average'] || 0);
    const parts: string[] = [doc.mediaType === 'tv' ? 'TV' : 'Movie'];
    if (year) parts.push(year);
    if (rating > 0) parts.push(`★ ${rating.toFixed(1)}`);

    return {
      id: doc.id,
      doc,
      title,
      posterUrl,
      metaSubtitle: parts.join(' • ')
    };
  }

  public getBookmarkState(doc: ContentDocType): BookmarkState {
    return doc.lists.includes('watched') ? 'watched' : 'watchlist';
  }

  public async onToggleBookmark(doc: ContentDocType): Promise<void> {
    if (doc.mediaType === 'person') return;
    const payload = doc.payload as Record<string, unknown> | undefined;
    const title = String(payload?.['title'] || payload?.['name'] || `#${doc.tmdbId}`);
    const prevState = this.getBookmarkState(doc);
    const nextState = await this.storage.cycleBookmark(
      doc.tmdbId,
      doc.mediaType,
      doc.payload as Record<string, unknown>
    );
    if (nextState === 'watched') {
      await this.toast.presentInfo(`Moved "${title}" to Watched`, 1800);
    } else if (nextState === 'none' && prevState === 'watchlist') {
      await this.toast.presentWarning(`Removed "${title}" from Watchlist (not released yet — cannot mark Watched)`, 2200);
    } else if (nextState === 'none') {
      await this.toast.presentWarning(`Removed "${title}" from Archive`, 1800);
    }
  }

  public onOpenPersonDetail(person: FavoritePersonCardVm): void {
    void this.router.navigate(['/person', person.id], {
      state: {
        preview: {
          id: person.id,
          name: person.name,
          profileUrl: person.profileUrl,
          knownFor: person.department
        }
      }
    });
  }

  public resolvePoster(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w342');
  }

  public onFranchiseClick(f: FranchiseCollectionSummary): void {
    void this.router.navigate(['/collection', f.id], {
      state: {
        title: f.name,
        preview: {
          id: f.id,
          name: f.name,
          posterUrl: this.resolvePoster(f.poster_path),
          backdropUrl: f.backdrop_path ? resolveMediaImageUrl(f.backdrop_path, 'w1280') : undefined
        }
      }
    });
  }

  public setFranchiseFilter(filter: 'all' | 'in_progress' | 'completed' | 'universes'): void {
    if (this.franchiseFilter() === filter) return;
    this.franchiseFilter.set(filter);
    this.triggerFadeAnimation();
    this.scrollPositions['franchises'] = 0;
    if (this.scrollEl) {
      this.scrollEl.scrollTop = 0;
    } else {
      void this.content?.scrollToTop(0);
    }
  }

  public onOpenUpNextPart(event: Event, f: FranchiseCollectionSummary): void {
    event.stopPropagation();
    const next = f.upNextPart;
    if (!next) {
      this.onFranchiseClick(f);
      return;
    }
    const mediaType = next.mediaType === 'tv' ? 'tv' : 'movie';
    void this.router.navigate(['/media', mediaType, next.id], {
      state: {
        preview: {
          id: next.id,
          mediaType,
          title: next.title,
          posterUrl: this.resolvePoster(next.poster_path),
          backdropUrl: next.backdrop_path ? resolveMediaImageUrl(next.backdrop_path, 'w1280') : undefined
        }
      }
    });
  }

  public isDirectlySaved(f: FranchiseCollectionSummary): boolean {
    return Boolean(f.isUniverse || this.storage.isFranchiseSaved(f.id));
  }

  public async onRemoveFranchiseOrUniverse(event: Event, f: FranchiseCollectionSummary): Promise<void> {
    event.stopPropagation();
    await this.franchiseAggregator.untrackFranchise(f.id, Boolean(f.isUniverse));
    if (f.isUniverse) {
      await this.toast.presentWarning(`Removed "${f.name}" universe from tracking`, 2000);
    } else {
      await this.toast.presentWarning(`Untracked "${f.name}" from Franchises`, 2000);
    }
  }

  public async onRemoveUniverse(event: Event, f: FranchiseCollectionSummary): Promise<void> {
    return this.onRemoveFranchiseOrUniverse(event, f);
  }

  public goToDiscover(): void {
    void this.router.navigate(['/tabs', 'discover']);
  }

  public goToDiscoverFranchises(): void {
    void this.router.navigate(['/search']);
  }

  public goToSearchPeople(): void {
    void this.router.navigate(['/search']);
  }

  public setPeopleFilter(filter: PeopleFilterType): void {
    if (this.peopleFilter() === filter) return;
    this.peopleFilter.set(filter);
    this.triggerFadeAnimation();
    this.scrollPositions['people'] = 0;
    if (this.scrollEl) {
      this.scrollEl.scrollTop = 0;
    } else {
      void this.content?.scrollToTop(0);
    }
  }

  public cyclePeopleSort(): void {
    const order: PeopleSortType[] = ['most_watched', 'completion', 'recent', 'alpha'];
    const currentIdx = order.indexOf(this.peopleSort());
    const next = order[(currentIdx + 1) % order.length];
    this.peopleSort.set(next);
    this.triggerFadeAnimation();
  }

  public async onRemoveFavoritePerson(event: Event, person: FavoritePersonCardVm): Promise<void> {
    event.stopPropagation();
    await this.storage.removeFavoritePerson(person.id);
    await this.toast.presentWarning(`Removed "${person.name}" from Favorite Artists`, 1800);
  }

  public onOpenPersonUpNext(event: Event, person: FavoritePersonCardVm): void {
    event.stopPropagation();
    const next = person.upNextCredit;
    if (!next) {
      this.onOpenPersonDetail(person);
      return;
    }
    const mediaType = next.mediaType === 'tv' ? 'tv' : 'movie';
    void this.router.navigate(['/media', mediaType, next.id], {
      state: {
        preview: {
          id: next.id,
          mediaType,
          title: next.title,
          posterUrl: this.resolvePoster(next.poster_path),
          backdropUrl: next.backdrop_path ? resolveMediaImageUrl(next.backdrop_path, 'w1280') : undefined
        }
      }
    });
  }

  public onPersonAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img) {
      img.src = 'assets/placeholders/placeholder.webp';
    }
  }
}
