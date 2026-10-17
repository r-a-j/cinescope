import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonIcon,
  IonSkeletonText,
  NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  shareSocialOutline,
  locationOutline,
  calendarOutline,
  star,
  filmOutline,
  tvOutline,
  globeOutline,
  openOutline,
  bookmarkOutline,
  bookmark,
  checkmarkCircle,
  trophyOutline
} from 'ionicons/icons';

import { TmdbPeopleService } from '../../core/services/tmdb-people.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

import { TmdbPersonDetailDto } from '../../core/dtos/people/person-detail.dto';
import {
  TmdbPersonCombinedCreditsResponseDto,
  TmdbPersonCastCreditDto,
  TmdbPersonCrewCreditDto
} from '../../core/dtos/people/person-combined-credits.dto';
import { TmdbPersonExternalIdsDto } from '../../core/dtos/people/person-external-ids.dto';
import { TmdbImageDto } from '../../core/dtos/common/image.dto';
import { SwimlaneComponent } from '../../shared/components/swimlane/swimlane.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { BookmarkState } from '../../shared/components/poster-card/poster-card.component';

export interface PersonPreviewState {
  id?: number | undefined;
  name?: string | undefined;
  profileUrl?: string | undefined;
  knownFor?: string | undefined;
}

export interface FilmographyEntryVm {
  uid: string;
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  roleLabel: string;
  year: string;
  sortTimestamp: number;
  popularity: number;
  rating: string | null;
  posterUrl: string;
  episodeCount?: number | undefined;
  rawPayload: Record<string, unknown>;
}

@Component({
  selector: 'app-person-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    IonSkeletonText,
    SwimlaneComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-detail.page.html',
  styleUrls: ['./person-detail.page.scss']
})
export class PersonDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private peopleService = inject(TmdbPeopleService);
  public storage = inject(StorageService);
  private toast = inject(ToastService);

  public personId = signal<number>(0);
  public isLoading = signal<boolean>(true);
  public preview = signal<PersonPreviewState | null>(null);
  public person = signal<TmdbPersonDetailDto | null>(null);

  public bioExpanded = signal<boolean>(false);
  public activeCreditTab = signal<'movies' | 'tv' | 'crew'>('movies');
  public sortBy = signal<'newest' | 'popular'>('newest');
  public visibleCreditsLimit = signal<number>(25);

  public name = computed<string>(() => {
    return this.person()?.name || this.preview()?.name || 'Loading...';
  });

  public department = computed<string>(() => {
    return this.person()?.known_for_department || this.preview()?.knownFor || 'Artist';
  });

  public profileUrl = computed<string>(() => {
    const path = this.person()?.profile_path;
    if (path) return resolveMediaImageUrl(path, 'w500');
    return this.preview()?.profileUrl || 'assets/placeholders/placeholder.webp';
  });

  public biography = computed<string>(() => {
    const bio = this.person()?.biography?.trim();
    return bio || 'No biography available yet for this artist.';
  });

  public birthPlace = computed<string | null>(() => {
    return this.person()?.place_of_birth?.trim() || null;
  });

  public lifespanLabel = computed<string | null>(() => {
    const p = this.person();
    if (!p?.birthday) return null;
    const birthYear = Number(p.birthday.slice(0, 4));
    if (p.deathday) {
      const deathYear = Number(p.deathday.slice(0, 4));
      const age = deathYear - birthYear;
      return `${p.birthday} – ${p.deathday} (Aged ${age})`;
    }
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    return `Born ${p.birthday} (${age} yrs)`;
  });

  public socialLinks = computed<{ label: string; url: string }[]>(() => {
    const ext = this.person()?.['external_ids'] as TmdbPersonExternalIdsDto | undefined;
    const links: { label: string; url: string }[] = [];
    const imdbId = ext?.imdb_id || this.person()?.imdb_id;
    if (imdbId) {
      links.push({ label: 'IMDb', url: `https://www.imdb.com/name/${imdbId}/` });
    }
    if (ext?.instagram_id) {
      links.push({ label: 'Instagram', url: `https://www.instagram.com/${ext.instagram_id}/` });
    }
    if (ext?.tiktok_id) {
      links.push({ label: 'TikTok', url: `https://www.tiktok.com/@${ext.tiktok_id}` });
    }
    if (ext?.twitter_id) {
      links.push({ label: 'X / Twitter', url: `https://x.com/${ext.twitter_id}` });
    }
    if (ext?.youtube_id) {
      links.push({ label: 'YouTube', url: `https://www.youtube.com/${ext.youtube_id}` });
    }
    return links;
  });

  public profileGallery = computed<string[]>(() => {
    const imgs = this.person()?.['images'] as { profiles?: TmdbImageDto[] } | undefined;
    const list = imgs?.profiles || [];
    return list
      .slice(0, 12)
      .map((img) => resolveMediaImageUrl(img.file_path, 'w342'));
  });

  private rawCombinedCredits = computed<TmdbPersonCombinedCreditsResponseDto | null>(() => {
    return (this.person()?.['combined_credits'] as TmdbPersonCombinedCreditsResponseDto | undefined) ?? null;
  });

  public knownForSwimlane = computed<SwimlaneItem[]>(() => {
    const credits = this.rawCombinedCredits();
    if (!credits) return [];

    const allCast = credits.cast || [];
    const allCrew = credits.crew || [];
    const combined = [...allCast, ...allCrew].filter((c) => c.poster_path);

    const uniqueMap = new Map<string, TmdbPersonCastCreditDto | TmdbPersonCrewCreditDto>();
    for (const item of combined) {
      const key = `${item.media_type}_${item.id}`;
      const existing = uniqueMap.get(key);
      if (!existing || (item.vote_count || 0) > (existing.vote_count || 0)) {
        uniqueMap.set(key, item);
      }
    }

    return [...uniqueMap.values()]
      .sort((a, b) => (b.vote_count || 0) * (b.popularity || 1) - (a.vote_count || 0) * (a.popularity || 1))
      .slice(0, 16)
      .map((item) => ({
        id: item.id,
        mediaType: item.media_type,
        title: (item.media_type === 'movie' ? item.title : item.name) || 'Untitled',
        subtitle: 'character' in item && item.character ? `as ${item.character}` : ('job' in item ? item.job : undefined),
        posterUrl: resolveMediaImageUrl(item.poster_path, 'w342'),
        payload: item as unknown as Record<string, unknown>
      }));
  });

  public movieCastEntries = computed<FilmographyEntryVm[]>(() => {
    const cast = this.rawCombinedCredits()?.cast || [];
    return this.sortFilmography(
      cast
        .filter((c) => c.media_type === 'movie')
        .map((c) => this.mapCastToVm(c))
    );
  });

  public tvCastEntries = computed<FilmographyEntryVm[]>(() => {
    const cast = this.rawCombinedCredits()?.cast || [];
    return this.sortFilmography(
      cast
        .filter((c) => c.media_type === 'tv')
        .map((c) => this.mapCastToVm(c))
    );
  });

  public crewEntries = computed<FilmographyEntryVm[]>(() => {
    const crew = this.rawCombinedCredits()?.crew || [];
    return this.sortFilmography(crew.map((c) => this.mapCrewToVm(c)));
  });

  public activeTabEntries = computed<FilmographyEntryVm[]>(() => {
    const tab = this.activeCreditTab();
    if (tab === 'movies') return this.movieCastEntries();
    if (tab === 'tv') return this.tvCastEntries();
    return this.crewEntries();
  });

  public visibleTabEntries = computed<FilmographyEntryVm[]>(() => {
    return this.activeTabEntries().slice(0, this.visibleCreditsLimit());
  });

  // Actor Marathon / Completionist Tracker
  public marathonStats = computed<{ watched: number; watchlist: number; total: number; percent: number }>(() => {
    const credits = this.rawCombinedCredits();
    if (!credits) return { watched: 0, watchlist: 0, total: 0, percent: 0 };

    const uniqueKeys = new Set<string>();
    for (const c of [...(credits.cast || []), ...(credits.crew || [])]) {
      uniqueKeys.add(`${c.media_type}_${c.id}`);
    }

    const total = uniqueKeys.size;
    if (total === 0) return { watched: 0, watchlist: 0, total: 0, percent: 0 };

    const stateMap = this.storage.bookmarkStateMap();
    let watched = 0;
    let watchlist = 0;
    for (const key of uniqueKeys) {
      if (stateMap[key] === 'watched') watched++;
      else if (stateMap[key] === 'watchlist') watchlist++;
    }

    const percent = Math.min(100, Math.round((watched / total) * 100));
    return { watched, watchlist, total, percent };
  });

  constructor() {
    addIcons({
      arrowBackOutline,
      shareSocialOutline,
      locationOutline,
      calendarOutline,
      star,
      filmOutline,
      tvOutline,
      globeOutline,
      openOutline,
      bookmarkOutline,
      bookmark,
      checkmarkCircle,
      trophyOutline
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!id || Number.isNaN(id)) return;
      this.personId.set(id);

      const navState = history.state as { preview?: PersonPreviewState } | undefined;
      if (navState?.preview && Number(navState.preview.id) === id) {
        this.preview.set(navState.preview);
      }

      void this.loadPersonDetails(id);
    });
  }

  public async loadPersonDetails(id: number): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.peopleService.getPersonDetails(id, 'combined_credits,external_ids,images')
      );
      this.person.set(res);

      // Default to crew tab if the person is primarily a Director/Writer with more crew than cast credits
      if (
        res.known_for_department !== 'Acting' &&
        this.movieCastEntries().length === 0 &&
        this.crewEntries().length > 0
      ) {
        this.activeCreditTab.set('crew');
      }
    } catch (err) {
      console.error('[PersonDetailPage] Failed to load person details:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  public setCreditTab(tab: 'movies' | 'tv' | 'crew'): void {
    this.activeCreditTab.set(tab);
    this.visibleCreditsLimit.set(25);
  }

  public showMoreCredits(): void {
    this.visibleCreditsLimit.update((v) => v + 30);
  }

  public openMediaDetail(entry: FilmographyEntryVm): void {
    void this.router.navigate(['/media', entry.mediaType, entry.id], {
      state: {
        preview: {
          id: entry.id,
          mediaType: entry.mediaType,
          title: entry.title,
          posterUrl: entry.posterUrl,
          releaseYear: entry.year,
          rating: entry.rating || undefined
        }
      }
    });
  }

  public getEntryBookmarkState(entry: FilmographyEntryVm): BookmarkState {
    return this.storage.getBookmarkState(entry.id, entry.mediaType);
  }

  public async toggleEntryBookmark(entry: FilmographyEntryVm, event: Event): Promise<void> {
    event.stopPropagation();
    const nextState = await this.storage.cycleBookmark(entry.id, entry.mediaType, {
      ...entry.rawPayload,
      id: entry.id,
      title: entry.title,
      name: entry.title,
      posterUrl: entry.posterUrl,
      media_type: entry.mediaType
    });

    if (nextState === 'watchlist') {
      await this.toast.presentSuccess(`Added "${entry.title}" to Watchlist`, 1800);
    } else if (nextState === 'watched') {
      await this.toast.presentInfo(`Marked "${entry.title}" as Watched`, 1800);
    } else {
      await this.toast.presentWarning(`Removed "${entry.title}" from Archive`, 1800);
    }
  }

  public async sharePerson(): Promise<void> {
    const personName = this.name();
    const tmdbUrl = `https://www.themoviedb.org/person/${this.personId()}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${personName} on CineScope`,
          text: `🌟 Explore ${personName}'s filmography on CineScope`,
          url: tmdbUrl
        });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${personName} — ${tmdbUrl}`);
        await this.toast.presentSuccess('Copied profile link to clipboard!', 1800);
      }
    } catch {
      // Dismissed share sheet
    }
  }

  public goBack(): void {
    this.navCtrl.back();
  }

  private mapCastToVm(c: TmdbPersonCastCreditDto): FilmographyEntryVm {
    const rawDate = (c.media_type === 'movie' ? c.release_date : c.first_air_date) || '';
    const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : 'TBA';
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    return {
      uid: c.credit_id || `${c.media_type}_${c.id}_${c.character}`,
      id: c.id,
      mediaType: c.media_type,
      title: (c.media_type === 'movie' ? c.title : c.name) || 'Untitled',
      roleLabel: c.character ? `as ${c.character}` : 'Actor',
      year,
      sortTimestamp: Number.isNaN(ts) ? 0 : ts,
      popularity: c.popularity || 0,
      rating: c.vote_average > 0 ? c.vote_average.toFixed(1) : null,
      posterUrl: resolveMediaImageUrl(c.poster_path, 'w185'),
      episodeCount: c.episode_count,
      rawPayload: c as unknown as Record<string, unknown>
    };
  }

  private mapCrewToVm(c: TmdbPersonCrewCreditDto): FilmographyEntryVm {
    const rawDate = (c.media_type === 'movie' ? c.release_date : c.first_air_date) || '';
    const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : 'TBA';
    const ts = rawDate ? new Date(rawDate).getTime() : 0;
    return {
      uid: c.credit_id || `${c.media_type}_${c.id}_${c.job}`,
      id: c.id,
      mediaType: c.media_type,
      title: (c.media_type === 'movie' ? c.title : c.name) || 'Untitled',
      roleLabel: c.job || c.department || 'Crew',
      year,
      sortTimestamp: Number.isNaN(ts) ? 0 : ts,
      popularity: c.popularity || 0,
      rating: c.vote_average > 0 ? c.vote_average.toFixed(1) : null,
      posterUrl: resolveMediaImageUrl(c.poster_path, 'w185'),
      episodeCount: c.episode_count,
      rawPayload: c as unknown as Record<string, unknown>
    };
  }

  private sortFilmography(items: FilmographyEntryVm[]): FilmographyEntryVm[] {
    const mode = this.sortBy();
    return [...items].sort((a, b) => {
      if (mode === 'popular') {
        return b.popularity - a.popularity;
      }
      if (a.sortTimestamp !== b.sortTimestamp) {
        return b.sortTimestamp - a.sortTimestamp;
      }
      return b.popularity - a.popularity;
    });
  }
}
