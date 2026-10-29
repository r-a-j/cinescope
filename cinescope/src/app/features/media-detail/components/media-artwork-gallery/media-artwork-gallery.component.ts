import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  computed,
  effect,
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
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';
import { ToastService } from '../../../../core/services/toast.service';

interface NativeGalleryPlugin {
  saveImage(options: { url: string; filename?: string }): Promise<{ success: boolean; uri?: string }>;
}
const NativeGallery = registerPlugin<NativeGalleryPlugin>('NativeGallery');

export type ArtworkCategory = 'backdrops' | 'posters' | 'logos';

export type ArtworkVariant = 'textless' | 'titled';

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
  const thumbSize = category === 'backdrops' ? 'w780' : 'w342';
  const previewSize = category === 'backdrops' ? 'w1280' : 'w780';

  const w = img.width || 0;
  const h = img.height || 0;
  const resolutionLabel = w > 0 && h > 0 ? `${w} × ${h}` : 'HD';

  let qualityTag = 'HD';
  if (category === 'backdrops') {
    if (w >= 3840) qualityTag = '4K UHD';
    else if (w >= 2560) qualityTag = '2K QHD';
    else if (w >= 1920) qualityTag = '1080p FHD';
  } else if (category === 'posters') {
    if (h >= 3000) qualityTag = 'UHD';
    else if (h >= 1500) qualityTag = 'HD';
  } else {
    qualityTag = 'PNG';
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
    aspectRatio: img.aspect_ratio || (category === 'backdrops' ? 1.778 : 0.667),
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

  const entries: ArtworkFilterOption[] = Array.from(counts.entries()).map(([code, count]) => {
    let label = '';
    if (code === 'none') {
      label = category === 'backdrops' ? 'Textless Wallpapers' : 'No Language';
    } else {
      label = getLanguageDisplayName(code);
    }
    return { id: code, label, count };
  });

  entries.sort((a, b) => {
    if (category === 'backdrops') {
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
  public backdrops = input<TmdbImageDto[]>([]);
  public posters = input<TmdbImageDto[]>([]);
  public logos = input<TmdbImageDto[]>([]);

  public activeCategory = signal<ArtworkCategory>('backdrops');
  public selectedFilterId = signal<string>('all');
  public lightboxIndex = signal<number | null>(null);
  public lightboxLoaded = signal<boolean>(false);
  public isSavingImage = signal<boolean>(false);

  private backButtonSub: (() => void) | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;

  public backdropItems = computed<ArtworkGalleryItem[]>(() => {
    return sortAndDedupeTmdbImages(this.backdrops()).map((img) => mapTmdbImageToArtworkItem(img, 'backdrops'));
  });

  public posterItems = computed<ArtworkGalleryItem[]>(() => {
    return sortAndDedupeTmdbImages(this.posters()).map((img) => mapTmdbImageToArtworkItem(img, 'posters'));
  });

  public logoItems = computed<ArtworkGalleryItem[]>(() => {
    return sortAndDedupeTmdbImages(this.logos()).map((img) => mapTmdbImageToArtworkItem(img, 'logos'));
  });

  public totalCount = computed<number>(() => {
    return this.backdropItems().length + this.posterItems().length + this.logoItems().length;
  });

  /** All items of the active main category, before sub-category filtering. */
  public categoryItems = computed<ArtworkGalleryItem[]>(() => {
    const cat = this.activeCategory();
    if (cat === 'backdrops') return this.backdropItems();
    if (cat === 'posters') return this.posterItems();
    return this.logoItems();
  });

  public filterOptions = computed<ArtworkFilterOption[]>(() => {
    return buildArtworkFilterOptions(this.categoryItems(), this.activeCategory());
  });

  /** Falls back to 'all' whenever the selected filter doesn't exist for the current category. */
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

  /** Capped view for the carousel to ensure 60fps scrolling on titles with 400+ posters. */
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

    // Ensure activeCategory automatically selects the first non-empty category
    effect(() => {
      const current = this.activeCategory();
      const bLen = this.backdropItems().length;
      const pLen = this.posterItems().length;
      const lLen = this.logoItems().length;

      if (current === 'backdrops' && bLen === 0) {
        if (pLen > 0) this.activeCategory.set('posters');
        else if (lLen > 0) this.activeCategory.set('logos');
      } else if (current === 'posters' && pLen === 0) {
        if (bLen > 0) this.activeCategory.set('backdrops');
        else if (lLen > 0) this.activeCategory.set('logos');
      } else if (current === 'logos' && lLen === 0) {
        if (bLen > 0) this.activeCategory.set('backdrops');
        else if (pLen > 0) this.activeCategory.set('posters');
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupBackButton();
  }

  public selectCategory(category: ArtworkCategory): void {
    if (this.activeCategory() === category) return;
    this.activeCategory.set(category);
    this.selectedFilterId.set('all');
  }

  public selectFilter(filterId: string): void {
    if (this.effectiveFilterId() === filterId) return;
    this.selectedFilterId.set(filterId);
    if (this.lightboxIndex() !== null) {
      this.lightboxLoaded.set(false);
      this.lightboxIndex.set(0);
      this.scrollActiveThumbnail();
    }
  }

  public openLightbox(index: number, category?: ArtworkCategory): void {
    if (category && this.activeCategory() !== category) {
      this.activeCategory.set(category);
      this.selectedFilterId.set('all');
    }
    const items = this.activeItems();
    if (index < 0 || index >= items.length) return;

    this.lightboxLoaded.set(false);
    this.lightboxIndex.set(index);
    this.scrollActiveThumbnail();

    if (!this.backButtonSub) {
      const sub = this.platform.backButton.subscribeWithPriority(9999, (): void => {
        this.closeLightbox();
      });
      this.backButtonSub = (): void => sub.unsubscribe();
    }
  }

  public openByFilePath(filePath: string | null | undefined, category: ArtworkCategory): void {
    this.activeCategory.set(category);
    this.selectedFilterId.set('all');
    const items = this.activeItems();
    const matchIndex = filePath ? items.findIndex((item) => item.filePath === filePath) : -1;
    this.openLightbox(matchIndex >= 0 ? matchIndex : 0);
  }

  public closeLightbox(): void {
    this.lightboxIndex.set(null);
    this.cleanupBackButton();
  }

  private cleanupBackButton(): void {
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
    const idx = this.lightboxIndex();
    const len = this.activeItems().length;
    if (idx === null || len <= 1) return;
    const nextIdx = (idx + delta + len) % len;
    if (nextIdx === idx) return;
    this.lightboxLoaded.set(false);
    this.lightboxIndex.set(nextIdx);
    this.scrollActiveThumbnail();
  }

  private scrollActiveThumbnail(): void {
    setTimeout(() => {
      const el = document.querySelector('.lb-mini-thumb.active');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 50);
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

      if (
        this.activeItems().length > 1 &&
        Math.abs(deltaX) > 40 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.3 &&
        elapsedTime < 600
      ) {
        if (deltaX < 0) {
          this.stepLightbox(1);
        } else {
          this.stepLightbox(-1);
        }
      } else if (deltaY > 75 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && elapsedTime < 600) {
        this.closeLightbox();
      }
    }
  }

  public getCategorySingularLabel(): string {
    const cat = this.activeCategory();
    if (cat === 'backdrops') return 'Wallpaper';
    if (cat === 'posters') return 'Poster';
    return 'Logo';
  }

  public getItemBadgeLabel(item: ArtworkGalleryItem): string {
    if (item.category === 'logos') return 'Title Logo';
    if (item.languageCode === null) {
      return item.category === 'backdrops' ? 'Clean Wallpaper' : 'Textless Poster';
    }
    return `${item.languageName} (${item.languageTag})`;
  }

  public async saveLightboxImage(event: Event): Promise<void> {
    event.stopPropagation();
    const item = this.lightboxItem();
    const idx = this.lightboxIndex();
    if (!item || this.isSavingImage()) return;

    const sanitizedTitle = this.mediaTitle().replace(/[^a-zA-Z0-9_-]/g, '_') || 'cinescope';
    const ext = item.filePath.split('.').pop()?.toLowerCase() || (item.category === 'logos' ? 'png' : 'jpg');
    const fileName = `${sanitizedTitle}_${item.category}_${(idx ?? 0) + 1}.${ext}`;
    const label = this.getCategorySingularLabel();

    if (Capacitor.isNativePlatform()) {
      this.isSavingImage.set(true);
      try {
        await NativeGallery.saveImage({ url: item.originalUrl, filename: fileName });
        await this.toast.presentSuccess(`${label} saved directly to your Photos Gallery`, 2500);
      } catch (nativeErr) {
        console.warn('[MediaArtworkGallery] Native gallery save failed, falling back:', nativeErr);
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
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
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
