import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
  computed,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ActionSheetController,
  IonContent,
  IonIcon,
  IonSkeletonText,
  IonSpinner,
  NavController,
  Platform
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  homeOutline,
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
  trophyOutline,
  downloadOutline,
  closeOutline,
  chevronBackOutline,
  chevronForwardOutline,
  imagesOutline,
  heart,
  heartOutline
} from 'ionicons/icons';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeGalleryPlugin {
  saveImage(options: { url: string; filename?: string }): Promise<{ success: boolean; uri?: string }>;
}
const NativeGallery = registerPlugin<NativeGalleryPlugin>('NativeGallery');

import { TmdbPeopleService } from '../../core/services/tmdb-people.service';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { NavigationService } from '../../core/services/navigation.service';
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
  knownForDepartment?: string | undefined;
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
    IonSpinner,
    SwimlaneComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-detail.page.html',
  styleUrls: ['./person-detail.page.scss']
})
export class PersonDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private peopleService = inject(TmdbPeopleService);
  public storage = inject(StorageService);
  private toast = inject(ToastService);
  private navService = inject(NavigationService);
  private platform = inject(Platform);
  private actionSheetCtrl = inject(ActionSheetController);

  public personId = signal<number>(0);
  private content = viewChild(IonContent);
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
    return this.person()?.known_for_department || this.preview()?.knownFor || this.preview()?.knownForDepartment || 'Artist';
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

  public profileGallery = computed<{ thumb: string; original: string }[]>(() => {
    const imgs = this.person()?.['images'] as { profiles?: TmdbImageDto[] } | undefined;
    const list = imgs?.profiles || [];
    return list
      .slice(0, 12)
      .map((img) => ({
        thumb: resolveMediaImageUrl(img.file_path, 'w342'),
        original: resolveMediaImageUrl(img.file_path, 'original')
      }));
  });

  public lightboxIndex = signal<number | null>(null);
  public lightboxLoaded = signal<boolean>(false);
  public isSavingImage = signal<boolean>(false);

  private backButtonSub: (() => void) | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  public lightboxImage = computed(() => {
    const i = this.lightboxIndex();
    return i === null ? null : (this.profileGallery()[i] ?? null);
  });

  public openLightbox(index: number): void {
    this.lightboxLoaded.set(false);
    this.lightboxIndex.set(index);

    // Register hardware back button priority handler to dismiss lightbox on Android / mobile
    if (!this.backButtonSub) {
      const sub = this.platform.backButton.subscribeWithPriority(9999, (): void => {
        this.closeLightbox();
      });
      this.backButtonSub = (): void => sub.unsubscribe();
    }
  }

  public closeLightbox(): void {
    this.lightboxIndex.set(null);
    if (this.backButtonSub) {
      this.backButtonSub();
      this.backButtonSub = null;
    }
  }

  public onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeLightbox();
    }
  }

  public stepLightbox(delta: number, event?: Event): void {
    event?.stopPropagation();
    const i = this.lightboxIndex();
    const len = this.profileGallery().length;
    if (i === null || len <= 1) return;
    const nextIndex = (i + delta + len) % len;
    if (nextIndex === i) return;
    this.lightboxLoaded.set(false);
    this.lightboxIndex.set(nextIndex);
  }

  @HostListener('window:keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (this.lightboxIndex() === null) return;
    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowRight') {
      this.stepLightbox(1);
    } else if (event.key === 'ArrowLeft') {
      this.stepLightbox(-1);
    }
  }

  public onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
      this.touchStartTime = Date.now();
    }
  }

  public onTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length === 1) {
      const deltaX = event.changedTouches[0].clientX - this.touchStartX;
      const deltaY = event.changedTouches[0].clientY - this.touchStartY;
      const elapsedTime = Date.now() - this.touchStartTime;

      // Horizontal swipe to browse next / previous portrait
      if (this.profileGallery().length > 1 && Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && elapsedTime < 600) {
        if (deltaX < 0) {
          this.stepLightbox(1);
        } else {
          this.stepLightbox(-1);
        }
      }
      // Vertical swipe down to dismiss lightbox
      else if (deltaY > 75 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && elapsedTime < 600) {
        this.closeLightbox();
      }
    }
  }

  public async saveLightboxImage(event: Event): Promise<void> {
    event.stopPropagation();
    const img = this.lightboxImage();
    const idx = this.lightboxIndex();
    if (!img || this.isSavingImage()) return;

    const sanitizedName = this.name().replace(/[^a-zA-Z0-9_-]/g, '_') || 'portrait';
    const fileName = `${sanitizedName}_portrait_${(idx ?? 0) + 1}.jpg`;

    // 1. Native Capacitor Application (Android / iOS):
    // Directly saves to MediaStore / Pictures / Gallery without opening a share sheet!
    if (Capacitor.isNativePlatform()) {
      this.isSavingImage.set(true);
      try {
        await NativeGallery.saveImage({ url: img.original, filename: fileName });
        await this.toast.presentSuccess('Portrait saved directly to your Photos Gallery!', 2500);
      } catch (nativeErr) {
        console.warn('[PersonDetailPage] Native gallery save failed, falling back:', nativeErr);
        await this.downloadBlobFile(img, fileName);
      } finally {
        this.isSavingImage.set(false);
      }
      return;
    }

    // 2. Mobile Browser (Chrome/Safari on mobile):
    // Browser security sandboxes prevent websites from writing directly to MediaStore without user prompt.
    // We provide an explicit ActionSheet so users can choose between Gallery/Photos or Files download!
    const isMobileBrowser = this.platform.is('mobile') || this.platform.is('mobileweb') || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobileBrowser) {
      const sheet = await this.actionSheetCtrl.create({
        header: 'Save Portrait',
        subHeader: 'Choose how you want to save this portrait',
        buttons: [
          {
            text: 'Save to Gallery / Photos',
            icon: 'images-outline',
            handler: (): void => {
              void this.saveToGalleryViaSystem(img, fileName);
            }
          },
          {
            text: 'Download to Files Folder',
            icon: 'download-outline',
            handler: (): void => {
              void this.downloadBlobFile(img, fileName);
            }
          },
          {
            text: 'Cancel',
            role: 'cancel',
            icon: 'close-outline'
          }
        ]
      });
      await sheet.present();
      return;
    }

    // 3. Desktop Web Browser:
    await this.downloadBlobFile(img, fileName);
  }

  private async saveToGalleryViaSystem(img: { thumb: string; original: string }, fileName: string): Promise<void> {
    this.isSavingImage.set(true);
    try {
      const corsUrl = `${img.original}${img.original.includes('?') ? '&' : '?'}cors_dl=${Date.now()}`;
      const res = await fetch(corsUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${this.name()} Portrait`
        });
      } else {
        await this.downloadBlobFile(img, fileName);
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        console.warn('[PersonDetailPage] System save failed, falling back to download:', err);
        await this.downloadBlobFile(img, fileName);
      }
    } finally {
      this.isSavingImage.set(false);
    }
  }

  private async downloadBlobFile(img: { thumb: string; original: string }, fileName: string): Promise<void> {
    this.isSavingImage.set(true);
    try {
      const corsUrl = `${img.original}${img.original.includes('?') ? '&' : '?'}cors_dl=${Date.now()}`;
      const res = await fetch(corsUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);

      const isMobile = this.platform.is('mobile') || this.platform.is('mobileweb') || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await this.toast.presentSuccess('Saved to Downloads folder. Check your Files app.', 2800);
      } else {
        await this.toast.presentSuccess('Portrait downloaded', 2000);
      }
    } catch (err) {
      console.warn('[PersonDetailPage] Direct blob download failed, falling back to direct link:', err);
      try {
        const link = document.createElement('a');
        link.href = img.original;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        await this.toast.presentInfo('Opening image. Long-press or right-click to save.', 3000);
      } catch (fallbackErr) {
        console.error('[PersonDetailPage] Fallback download failed:', fallbackErr);
        await this.toast.presentWarning('Unable to save image directly', 2000);
      }
    } finally {
      this.isSavingImage.set(false);
    }
  }

  public async shareLightboxImage(event: Event): Promise<void> {
    event.stopPropagation();
    const img = this.lightboxImage();
    if (!img) return;

    const personName = this.name();
    const shareData = {
      title: `${personName} Portrait`,
      text: `Portrait of ${personName} on CineScope`,
      url: img.original
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(img.original);
        await this.toast.presentSuccess('Image link copied to clipboard', 1800);
      }
    } catch {
      // User cancelled share dialog
    }
  }

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

  public isFavorite = computed<boolean>(() => {
    const id = this.personId();
    return id > 0 ? this.storage.isPersonFavorite(id) : false;
  });

  public collectCreditIds(): string[] {
    const credits = this.rawCombinedCredits();
    if (!credits) return [];
    const set = new Set<string>();
    for (const c of [...(credits.cast || []), ...(credits.crew || [])]) {
      if (c.id && c.media_type) {
        set.add(`${c.media_type}_${c.id}`);
      }
    }
    return Array.from(set);
  }

  public async toggleFavorite(): Promise<void> {
    const id = this.personId();
    if (!id) return;
    const creditIds = this.collectCreditIds();
    const isNowFav = await this.storage.toggleFavoritePerson({
      id,
      name: this.name(),
      profilePath: this.person()?.profile_path ?? null,
      department: this.department(),
      creditIds
    });
    if (isNowFav) {
      await this.toast.presentSuccess(`Added ${this.name()} to Favorites`, 1800);
    } else {
      await this.toast.presentWarning(`Removed ${this.name()} from Favorites`, 1800);
    }
  }

  constructor() {
    addIcons({
      arrowBackOutline,
      homeOutline,
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
      trophyOutline,
      downloadOutline,
      closeOutline,
      chevronBackOutline,
      chevronForwardOutline,
      imagesOutline,
      heart,
      heartOutline
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!id || Number.isNaN(id)) return;

      // Reset stale view state when transitioning to another artist
      this.person.set(null);
      this.preview.set(null);
      this.closeLightbox();
      this.bioExpanded.set(false);
      this.activeCreditTab.set('movies');
      this.sortBy.set('newest');
      this.visibleCreditsLimit.set(25);
      void this.content()?.scrollToTop(0);

      this.personId.set(id);

      const navState = history.state as { preview?: PersonPreviewState } | undefined;
      if (navState?.preview && Number(navState.preview.id) === id) {
        this.preview.set(navState.preview);
      }

      void this.loadPersonDetails(id);
    });
  }

  ngOnDestroy(): void {
    if (this.backButtonSub) {
      this.backButtonSub();
      this.backButtonSub = null;
    }
  }

  public async loadPersonDetails(id: number): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.peopleService.getPersonDetails(id, 'combined_credits,external_ids,images')
      );
      if (this.personId() !== id) return;
      this.person.set(res);

      // Default to crew tab if the person is primarily a Director/Writer with more crew than cast credits
      if (
        res.known_for_department !== 'Acting' &&
        this.movieCastEntries().length === 0 &&
        this.crewEntries().length > 0
      ) {
        this.activeCreditTab.set('crew');
      }

      // If person is already favorited, keep cached filmography credit IDs updated
      if (this.storage.isPersonFavorite(id)) {
        const creditIds = this.collectCreditIds();
        if (creditIds.length > 0) {
          void this.storage.updateFavoritePersonCredits(id, creditIds);
        }
      }
    } catch (err) {
      console.error('[PersonDetailPage] Failed to load person details:', err);
      if (this.personId() === id) {
        this.person.set(null);
      }
    } finally {
      if (this.personId() === id) {
        this.isLoading.set(false);
      }
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
    const rawBackdrop = entry.rawPayload?.['backdrop_path'] as string | undefined;
    const overview = entry.rawPayload?.['overview'] as string | undefined;
    void this.router.navigate(['/media', entry.mediaType, entry.id], {
      state: {
        preview: {
          id: entry.id,
          mediaType: entry.mediaType,
          title: entry.title,
          overview,
          posterUrl: entry.posterUrl,
          backdropUrl: rawBackdrop ? resolveMediaImageUrl(rawBackdrop, 'w1280') : undefined,
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
    const prevState = this.storage.getBookmarkState(entry.id, entry.mediaType);
    event.stopPropagation();
    const nextState = await this.storage.cycleBookmark(entry.id, entry.mediaType, {
      ...entry.rawPayload,
      id: entry.id,
      title: entry.title,
      name: entry.title,
      posterUrl: entry.posterUrl,
      releaseYear: entry.year,
      media_type: entry.mediaType
    });

    if (nextState === 'watchlist') {
      await this.toast.presentSuccess(`Added "${entry.title}" to Watchlist`, 1800);
    } else if (nextState === 'watched') {
      await this.toast.presentInfo(`Marked "${entry.title}" as Watched`, 1800);
    } else if (prevState === 'watchlist') {
      await this.toast.presentWarning(`Removed "${entry.title}" from Watchlist (not released yet — cannot mark Watched)`, 2200);
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
    if (window.history.length > 1) {
      this.navCtrl.back();
    } else {
      this.navCtrl.navigateRoot('/tabs/discover', { animationDirection: 'back' });
    }
  }

  public goToHome(): void {
    this.closeLightbox();
    this.navService.navigateToHome();
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
