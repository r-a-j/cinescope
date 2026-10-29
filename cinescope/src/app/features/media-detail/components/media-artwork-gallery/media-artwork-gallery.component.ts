import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  computed,
  inject,
  OnDestroy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActionSheetController,
  IonIcon,
  IonSpinner,
  Platform
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  imagesOutline,
  downloadOutline,
  shareSocialOutline,
  closeOutline,
  chevronBackOutline,
  chevronForwardOutline,
  star,
  expandOutline
} from 'ionicons/icons';
import { Capacitor, registerPlugin } from '@capacitor/core';

import { TmdbImageDto } from '../../../../core/dtos/common/image.dto';
import { TmdbMovieImagesResponseDto } from '../../../../core/dtos/movies/movie-images.dto';
import { TmdbTvImagesResponseDto } from '../../../../core/dtos/tv/tv-images.dto';
import { TmdbTvSeasonImagesResponseDto } from '../../../../core/dtos/tv-seasons/tv-season-images.dto';
import { TmdbTvEpisodeImagesResponseDto } from '../../../../core/dtos/tv-episodes/tv-episode-images.dto';
import { TmdbPersonImagesResponseDto } from '../../../../core/dtos/people/person-images.dto';

export type TmdbImagesContainer =
  | TmdbMovieImagesResponseDto
  | TmdbTvImagesResponseDto
  | TmdbTvSeasonImagesResponseDto
  | TmdbTvEpisodeImagesResponseDto
  | TmdbPersonImagesResponseDto
  | Record<string, unknown>;
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';
import { ToastService } from '../../../../core/services/toast.service';

interface NativeGalleryPlugin {
  saveImage(options: { url: string; filename?: string }): Promise<{ success: boolean; uri?: string }>;
}
const NativeGallery = registerPlugin<NativeGalleryPlugin>('NativeGallery');

export type ArtworkCategory = 'backdrops' | 'posters' | 'logos' | 'stills' | 'profiles' | string;

export type ArtworkVariant = 'textless' | 'titled';

export interface ArtworkCategoryMeta {
  key: string;
  label: string;
  singularLabel: string;
  order: number;
  isLandscape: boolean;
  isTransparent: boolean;
  isPoster: boolean;
}

const CATEGORY_META: Record<string, { label: string; singularLabel: string; order: number; isLandscape?: boolean; isTransparent?: boolean; isPoster?: boolean }> = {
  backdrops: { label: 'Wallpapers', singularLabel: 'Wallpaper', order: 1, isLandscape: true },
  posters: { label: 'Posters', singularLabel: 'Poster', order: 2, isPoster: true },
  logos: { label: 'Logos', singularLabel: 'Logo', order: 3, isTransparent: true },
  stills: { label: 'Stills', singularLabel: 'Still', order: 4, isLandscape: true },
  profiles: { label: 'Portraits', singularLabel: 'Portrait', order: 5, isPoster: true }
};

export function getCategoryMeta(key: string): ArtworkCategoryMeta {
  const meta = CATEGORY_META[key];
  if (meta) {
    return {
      key,
      label: meta.label,
      singularLabel: meta.singularLabel,
      order: meta.order,
      isLandscape: !!meta.isLandscape,
      isTransparent: !!meta.isTransparent,
      isPoster: !!meta.isPoster
    };
  }
  const formatted = key.charAt(0).toUpperCase() + key.slice(1);
  return {
    key,
    label: formatted,
    singularLabel: formatted,
    order: 99,
    isLandscape: false,
    isTransparent: false,
    isPoster: false
  };
}

export function isLandscapeCategory(category: ArtworkCategory): boolean {
  return category === 'backdrops' || category === 'stills';
}

export function isPosterCategory(category: ArtworkCategory): boolean {
  return category === 'posters' || category === 'profiles';
}

export function isLogoCategory(category: ArtworkCategory): boolean {
  return category === 'logos';
}

export interface ArtworkGalleryItem {
  filePath: string;
  category: ArtworkCategory;
  variant: ArtworkVariant;
  languageCode: string | null;
  languageName: string;
  languageTag: string;
  thumbUrl: string;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  resolutionLabel: string;
  qualityTag: string;
  voteAverage: number;
  voteCount: number;
}

export interface ArtworkCategoryTab {
  key: string;
  label: string;
  singularLabel: string;
  count: number;
  items: ArtworkGalleryItem[];
  order: number;
}

export interface ArtworkFilterOption {
  id: string; // 'all' | 'none' | ISO-639-1 code (e.g. 'en', 'zh', 'de')
  label: string;
  count: number;
}

const languageDisplayNames = new Intl.DisplayNames(['en'], { type: 'language' });

export function getLanguageDisplayName(code: string | null): string {
  if (!code) return 'No Language';
  try {
    return languageDisplayNames.of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function mapTmdbImageToArtworkItem(
  img: TmdbImageDto,
  category: ArtworkCategory
): ArtworkGalleryItem {
  const isLandscape = isLandscapeCategory(category);
  const isLogo = isLogoCategory(category);
  const thumbSize = isLandscape ? 'w780' : isLogo ? 'w500' : 'w342';
  const previewSize = isLandscape ? 'w1280' : isLogo ? 'w500' : 'w780';

  const w = img.width || 0;
  const h = img.height || 0;
  const resolutionLabel = w > 0 && h > 0 ? `${w} × ${h}` : 'HD';

  let qualityTag = 'HD';
  if (isLandscape) {
    if (w >= 3840) qualityTag = '4K UHD';
    else if (w >= 2560) qualityTag = '2K QHD';
    else if (w >= 1920) qualityTag = '1080p FHD';
  } else if (isLogo) {
    qualityTag = 'PNG';
  } else {
    if (h >= 3000) qualityTag = 'UHD';
    else if (h >= 1500) qualityTag = 'HD';
  }

  const code = img.iso_639_1 ? img.iso_639_1.toLowerCase() : null;
  const variant: ArtworkVariant = code ? 'titled' : 'textless';
  const languageTag = code ? code.toUpperCase() : 'TEXTLESS';
  const languageName = getLanguageDisplayName(code);

  return {
    filePath: img.file_path,
    category,
    variant,
    languageCode: code,
    languageName,
    languageTag,
    thumbUrl: resolveMediaImageUrl(img.file_path, thumbSize),
    previewUrl: resolveMediaImageUrl(img.file_path, previewSize),
    originalUrl: resolveMediaImageUrl(img.file_path, 'original'),
    width: w,
    height: h,
    aspectRatio: img.aspect_ratio || (isLandscape ? 1.778 : isLogo ? 2.5 : 0.667),
    resolutionLabel,
    qualityTag,
    voteAverage: img.vote_average || 0,
    voteCount: img.vote_count || 0
  };
}

export function sortAndDedupeTmdbImages(images: TmdbImageDto[] | undefined): TmdbImageDto[] {
  if (!images || images.length === 0) return [];
  const seen = new Set<string>();
  const unique: TmdbImageDto[] = [];
  for (const img of images) {
    if (!img?.file_path || seen.has(img.file_path)) continue;
    seen.add(img.file_path);
    unique.push(img);
  }
  return unique.sort((a, b) => {
    const scoreA = (a.vote_average || 0) * Math.log10((a.vote_count || 0) + 2);
    const scoreB = (b.vote_average || 0) * Math.log10((b.vote_count || 0) + 2);
    if (Math.abs(scoreB - scoreA) > 0.05) {
      return scoreB - scoreA;
    }
    return (b.width || 0) - (a.width || 0);
  });
}

/**
 * Builds the language/variant sub-category filter options (All, English, Textless, etc.)
 * matching TMDB's breakdown as shown in Screenshots 3 & 4.
 */
export function buildArtworkFilterOptions(
  items: ArtworkGalleryItem[],
  category: ArtworkCategory
): ArtworkFilterOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.languageCode || 'none';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  if (counts.size <= 1) return [];

  const isLandscape = isLandscapeCategory(category);
  const entries: ArtworkFilterOption[] = Array.from(counts.entries()).map(([code, count]) => {
    let label = '';
    if (code === 'none') {
      label = isLandscape ? 'Textless Wallpapers' : 'No Language';
    } else {
      label = getLanguageDisplayName(code);
    }
    return { id: code, label, count };
  });

  entries.sort((a, b) => {
    if (isLandscape) {
      if (a.id === 'none') return -1;
      if (b.id === 'none') return 1;
      if (a.id === 'en') return -1;
      if (b.id === 'en') return 1;
    } else {
      if (a.id === 'en') return -1;
      if (b.id === 'en') return 1;
      if (a.id === 'none') return -1;
      if (b.id === 'none') return 1;
    }
    return b.count - a.count;
  });

  return [{ id: 'all', label: 'All', count: items.length }, ...entries];
}

@Component({
  selector: 'app-media-artwork-gallery',
  standalone: true,
  imports: [CommonModule, IonIcon, IonSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-artwork-gallery.component.html',
  styleUrls: ['./media-artwork-gallery.component.scss']
})
export class MediaArtworkGalleryComponent implements OnDestroy {
  private platform = inject(Platform);
  private actionSheetCtrl = inject(ActionSheetController);
  private toast = inject(ToastService);

  public mediaTitle = input.required<string>();

  /**
   * Primary dynamic input: directly pass a map of image arrays from any TMDB endpoint,
   * e.g. from Movie/TV ({ backdrops, posters, logos }), Season ({ posters }),
   * Episode ({ stills }), or Person ({ profiles }).
   */
  public images = input<TmdbImagesContainer | null>(null);
  public primaryBackdropPath = input<string | null>(null);
  public primaryPosterPath = input<string | null>(null);

  /** Backward-compatible legacy inputs */
  public backdrops = input<TmdbImageDto[]>([]);
  public posters = input<TmdbImageDto[]>([]);
  public logos = input<TmdbImageDto[]>([]);

  public activeCategory = signal<string>('backdrops');
  public selectedFilterId = signal<string>('all');
  public lightboxIndex = signal<number | null>(null);
  public lightboxLoaded = signal<boolean>(false);
  public isSavingImage = signal<boolean>(false);

  private backButtonSub: (() => void) | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  /** Dynamically resolves all categories present in the incoming images */
  public availableCategories = computed<ArtworkCategoryTab[]>(() => {
    const map = new Map<string, TmdbImageDto[]>();

    // 1. Gather from dynamic images input if provided
    const dynamicMap = this.images();
    if (dynamicMap) {
      for (const [key, value] of Object.entries(dynamicMap)) {
        if (Array.isArray(value) && value.length > 0) {
          const first = value[0] as unknown;
          if (typeof first === 'object' && first !== null && 'file_path' in first) {
            map.set(key, value as TmdbImageDto[]);
          }
        }
      }
    }

    // 2. Gather from legacy inputs if not already present
    if (this.backdrops().length > 0 && !map.has('backdrops')) {
      map.set('backdrops', this.backdrops());
    }
    if (this.posters().length > 0 && !map.has('posters')) {
      map.set('posters', this.posters());
    }
    if (this.logos().length > 0 && !map.has('logos')) {
      map.set('logos', this.logos());
    }

    // 3. Inject primary hero assets if provided and not already included
    const primaryBackdrop = this.primaryBackdropPath();
    const existingBackdrops = map.get('backdrops');
    if (primaryBackdrop && existingBackdrops) {
      if (!existingBackdrops.some((b) => b.file_path === primaryBackdrop)) {
        map.set('backdrops', [
          {
            aspect_ratio: 1.778,
            height: 1080,
            width: 1920,
            iso_639_1: null,
            file_path: primaryBackdrop,
            vote_average: 5,
            vote_count: 1
          },
          ...existingBackdrops
        ]);
      }
    }

    const primaryPoster = this.primaryPosterPath();
    if (primaryPoster) {
      const targetKey = map.has('posters') ? 'posters' : map.has('profiles') ? 'profiles' : null;
      if (targetKey) {
        const list = map.get(targetKey);
        if (list && !list.some((p) => p.file_path === primaryPoster)) {
          map.set(targetKey, [
            {
              aspect_ratio: 0.667,
              height: 1500,
              width: 1000,
              iso_639_1: 'en',
              file_path: primaryPoster,
              vote_average: 5,
              vote_count: 1
            },
            ...list
          ]);
        }
      }
    }

    const priorityOrder: Record<string, number> = {
      backdrops: 1,
      posters: 2,
      logos: 3,
      stills: 4,
      profiles: 5
    };

    const tabs: ArtworkCategoryTab[] = [];
    for (const [key, rawList] of map.entries()) {
      const items = sortAndDedupeTmdbImages(rawList).map((img) =>
        mapTmdbImageToArtworkItem(img, key)
      );
      if (items.length === 0) continue;

      const meta = getCategoryMeta(key);
      tabs.push({
        key,
        label: meta.label,
        singularLabel: meta.singularLabel,
        count: items.length,
        items,
        order: priorityOrder[key] ?? 99
      });
    }

    return tabs.sort((a, b) => a.order - b.order);
  });

  /** Falls back automatically to the first available non-empty category */
  public effectiveCategory = computed<string>(() => {
    const list = this.availableCategories();
    if (list.length === 0) return 'backdrops';
    const active = this.activeCategory();
    return list.some((c) => c.key === active) ? active : list[0].key;
  });

  public currentCategoryTab = computed<ArtworkCategoryTab | null>(() => {
    const eff = this.effectiveCategory();
    return this.availableCategories().find((c) => c.key === eff) ?? null;
  });

  public totalCount = computed<number>(() => {
    return this.availableCategories().reduce((acc, cat) => acc + cat.count, 0);
  });

  /** Legacy computed arrays for backward compatibility */
  public backdropItems = computed<ArtworkGalleryItem[]>(() => {
    return this.availableCategories().find((c) => c.key === 'backdrops')?.items ?? [];
  });

  public posterItems = computed<ArtworkGalleryItem[]>(() => {
    return this.availableCategories().find((c) => c.key === 'posters')?.items ?? [];
  });

  public logoItems = computed<ArtworkGalleryItem[]>(() => {
    return this.availableCategories().find((c) => c.key === 'logos')?.items ?? [];
  });

  /** All items of the active main category, before sub-category filtering */
  public categoryItems = computed<ArtworkGalleryItem[]>(() => {
    return this.currentCategoryTab()?.items ?? [];
  });

  public filterOptions = computed<ArtworkFilterOption[]>(() => {
    return buildArtworkFilterOptions(this.categoryItems(), this.effectiveCategory());
  });

  /** Falls back to 'all' whenever the selected filter doesn't exist for the current category */
  public effectiveFilterId = computed<string>(() => {
    const selected = this.selectedFilterId();
    if (selected === 'all') return 'all';
    const option = this.filterOptions().find((o) => o.id === selected);
    return option && option.count > 0 ? selected : 'all';
  });

  public activeItems = computed<ArtworkGalleryItem[]>(() => {
    const items = this.categoryItems();
    const filter = this.effectiveFilterId();
    if (filter === 'all') return items;
    if (filter === 'none') return items.filter((i) => i.languageCode === null);
    return items.filter((i) => i.languageCode === filter);
  });

  /** Capped view for the carousel to ensure 60fps scrolling on titles with 400+ posters */
  public displayedItems = computed<ArtworkGalleryItem[]>(() => {
    return this.activeItems().slice(0, 60);
  });

  public lightboxItem = computed<ArtworkGalleryItem | null>(() => {
    const idx = this.lightboxIndex();
    if (idx === null) return null;
    return this.activeItems()[idx] ?? null;
  });

  constructor() {
    addIcons({
      imagesOutline,
      downloadOutline,
      shareSocialOutline,
      closeOutline,
      chevronBackOutline,
      chevronForwardOutline,
      star,
      expandOutline
    });
  }

  ngOnDestroy(): void {
    this.cleanupBackButton();
  }

  public selectCategory(category: string): void {
    if (this.effectiveCategory() === category) return;
    this.activeCategory.set(category);
    this.selectedFilterId.set('all');
    this.lightboxIndex.set(null);
  }

  public selectFilter(filterId: string): void {
    if (this.effectiveFilterId() === filterId) return;
    this.selectedFilterId.set(filterId);

    // Keep lightbox index pointing to a valid item in the filtered set
    const currentIdx = this.lightboxIndex();
    if (currentIdx !== null) {
      const maxIdx = Math.max(0, this.activeItems().length - 1);
      const safeIdx = Math.min(currentIdx, maxIdx);
      this.lightboxIndex.set(safeIdx);
      this.lightboxLoaded.set(false);
      this.scrollActiveThumbnail(safeIdx);
    }
  }

  public openLightbox(index = 0, category?: string): void {
    if (category && category !== this.effectiveCategory()) {
      this.activeCategory.set(category);
      this.selectedFilterId.set('all');
    }
    const maxIdx = Math.max(0, this.activeItems().length - 1);
    const safeIdx = Math.min(Math.max(0, index), maxIdx);
    this.lightboxLoaded.set(false);
    this.lightboxIndex.set(safeIdx);
    this.setupBackButtonListener();
    this.scrollActiveThumbnail(safeIdx);
  }

  public openByFilePath(filePath: string | null | undefined, category = 'posters'): void {
    if (!filePath) {
      this.openLightbox(0, category);
      return;
    }
    this.selectCategory(category);
    this.selectedFilterId.set('all');
    const idx = this.activeItems().findIndex((item) => item.filePath === filePath);
    this.openLightbox(idx >= 0 ? idx : 0, category);
  }

  public closeLightbox(): void {
    this.lightboxIndex.set(null);
    this.lightboxLoaded.set(false);
    this.cleanupBackButton();
  }

  public stepLightbox(delta: number, event?: Event): void {
    event?.stopPropagation();
    const items = this.activeItems();
    if (items.length <= 1) return;

    const current = this.lightboxIndex() ?? 0;
    const next = (current + delta + items.length) % items.length;
    this.lightboxLoaded.set(false);
    this.lightboxIndex.set(next);
    this.scrollActiveThumbnail(next);
  }

  private scrollActiveThumbnail(index: number): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      const container = document.querySelector<HTMLElement>('.artwork-lightbox .lightbox-thumb-strip');
      const thumbs = document.querySelectorAll<HTMLElement>('.artwork-lightbox .lb-mini-thumb');
      const activeThumb = thumbs[index];
      if (container && activeThumb) {
        const targetScrollLeft = activeThumb.offsetLeft - (container.clientWidth / 2) + (activeThumb.offsetWidth / 2);
        container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
      }
    }, 60);
  }

  private setupBackButtonListener(): void {
    if (this.backButtonSub) return;
    const backSub = this.platform.backButton.subscribeWithPriority(9999, () => {
      this.closeLightbox();
    });
    this.backButtonSub = (): void => backSub.unsubscribe();
  }

  private cleanupBackButton(): void {
    if (this.backButtonSub) {
      this.backButtonSub();
      this.backButtonSub = null;
    }
  }

  public onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('.lightbox-bottom-bar') ||
      target?.closest('.lightbox-toolbar') ||
      target?.closest('.stage-img')
    ) {
      return;
    }
    if (event.target === event.currentTarget || target?.classList.contains('lightbox-stage')) {
      this.closeLightbox();
    }
  }

  @HostListener('window:keydown', ['$event'])
  public handleKeydown(event: KeyboardEvent): void {
    if (this.lightboxIndex() === null) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.stepLightbox(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepLightbox(1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeLightbox();
    }
  }

  public onTouchStart(event: TouchEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.lightbox-bottom-bar') || target?.closest('.lightbox-toolbar')) {
      this.touchStartX = 0;
      return;
    }
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
  }

  public onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.lightbox-bottom-bar') || target?.closest('.lightbox-toolbar')) {
      this.touchStartX = 0;
      return;
    }
    if (event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const elapsedTime = Date.now() - this.touchStartTime;
    this.touchStartX = 0;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) && elapsedTime < 450) {
      if (deltaX > 0) {
        this.stepLightbox(-1);
      } else {
        this.stepLightbox(1);
      }
    } else if (deltaY > 75 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && elapsedTime < 600) {
      this.closeLightbox();
    }
  }

  public getCategorySingularLabel(): string {
    const cat = this.effectiveCategory();
    const found = this.availableCategories().find((c) => c.key === cat);
    return found?.singularLabel || getCategoryMeta(cat).singularLabel;
  }

  public getItemBadgeLabel(item: ArtworkGalleryItem): string {
    if (item.category === 'logos') {
      return item.languageCode ? `${item.languageName} (${item.languageTag})` : 'Title Logo';
    }
    if (item.languageCode === null) {
      if (item.category === 'backdrops') return 'Clean Wallpaper';
      if (item.category === 'stills') return 'Episode Still';
      if (item.category === 'profiles') return 'Portrait';
      return 'Textless Poster';
    }
    return `${item.languageName} (${item.languageTag})`;
  }

  public async saveLightboxImage(event: Event): Promise<void> {
    event.stopPropagation();
    const item = this.lightboxItem();
    const idx = this.lightboxIndex();
    if (!item || this.isSavingImage()) return;

    const sanitizedTitle = this.mediaTitle().replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const ext = item.filePath.split('.').pop()?.toLowerCase() || (item.category === 'logos' ? 'png' : 'jpg');
    const fileName = `${sanitizedTitle}_${item.category}_${(idx ?? 0) + 1}.${ext}`;
    const label = this.getCategorySingularLabel();

    if (Capacitor.isNativePlatform()) {
      this.isSavingImage.set(true);
      try {
        await NativeGallery.saveImage({ url: item.originalUrl, filename: fileName });
        await this.toast.presentSuccess(`${label} saved to Photos / Gallery`, 2500);
      } catch (err) {
        console.warn('[MediaArtworkGallery] Native save failed, falling back:', err);
        await this.downloadBlobFile(item, fileName, label);
      } finally {
        this.isSavingImage.set(false);
      }
      return;
    }

    const isMobileBrowser =
      this.platform.is('mobile') ||
      this.platform.is('mobileweb') ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobileBrowser) {
      const sheet = await this.actionSheetCtrl.create({
        header: `Save ${label}`,
        ...(item.category !== 'posters' ? { subHeader: `Original resolution (${item.resolutionLabel})` } : {}),
        buttons: [
          {
            text: 'Save to Gallery / Photos',
            icon: 'images-outline',
            handler: (): void => {
              void this.saveToGalleryViaSystem(item, fileName, label);
            }
          },
          {
            text: 'Download to Files Folder',
            icon: 'download-outline',
            handler: (): void => {
              void this.downloadBlobFile(item, fileName, label);
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

    await this.downloadBlobFile(item, fileName, label);
  }

  private async saveToGalleryViaSystem(
    item: ArtworkGalleryItem,
    fileName: string,
    label: string
  ): Promise<void> {
    this.isSavingImage.set(true);
    try {
      const corsUrl = `${item.originalUrl}${item.originalUrl.includes('?') ? '&' : '?'}cors_dl=${Date.now()}`;
      const res = await fetch(corsUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${this.mediaTitle()} ${label}`
        });
      } else {
        await this.downloadBlobFile(item, fileName, label);
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        console.warn('[MediaArtworkGallery] System save failed, falling back to download:', err);
        await this.downloadBlobFile(item, fileName, label);
      }
    } finally {
      this.isSavingImage.set(false);
    }
  }

  private async downloadBlobFile(
    item: ArtworkGalleryItem,
    fileName: string,
    label: string
  ): Promise<void> {
    this.isSavingImage.set(true);
    try {
      const corsUrl = `${item.originalUrl}${item.originalUrl.includes('?') ? '&' : '?'}cors_dl=${Date.now()}`;
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

      const isMobile =
        this.platform.is('mobile') ||
        this.platform.is('mobileweb') ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await this.toast.presentSuccess('Saved to Downloads folder. Check your Files app.', 2800);
      } else {
        await this.toast.presentSuccess(`${label} downloaded`, 2000);
      }
    } catch {
      try {
        const link = document.createElement('a');
        link.href = item.originalUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        await this.toast.presentInfo('Opening image. Long-press or right-click to save.', 3000);
      } catch {
        await this.toast.presentWarning('Unable to save image directly', 2000);
      }
    } finally {
      this.isSavingImage.set(false);
    }
  }

  public async shareLightboxImage(event: Event): Promise<void> {
    event.stopPropagation();
    const item = this.lightboxItem();
    if (!item) return;

    const label = this.getCategorySingularLabel();
    const shareData = {
      title: `${this.mediaTitle()} ${label}`,
      text: `${this.mediaTitle()} (${item.resolutionLabel}) on CineScope`,
      url: item.originalUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.originalUrl);
        await this.toast.presentSuccess('Image link copied to clipboard', 1800);
      }
    } catch {
      // User cancelled share dialog
    }
  }
}
