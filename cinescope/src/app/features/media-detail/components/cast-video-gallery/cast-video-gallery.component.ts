import { Component, ChangeDetectionStrategy, input, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IonIcon, Platform } from '@ionic/angular/standalone';
import { TmdbVideoDto } from '../../../../core/dtos/common/video.dto';
import { CastMemberVm } from '../../media-detail.page';

export interface VideoTypeGroup {
  /** Raw TMDB video type, or 'all' for the combined view. */
  type: string;
  label: string;
  count: number;
}

/** Display order and plural labels for TMDB's internal video types. */
const KNOWN_VIDEO_TYPE_META: Record<string, { order: number; label: string }> = {
  Trailer: { order: 1, label: 'Trailers' },
  Teaser: { order: 2, label: 'Teasers' },
  Promo: { order: 3, label: 'Promos' },
  Clip: { order: 4, label: 'Clips' },
  Featurette: { order: 5, label: 'Featurettes' },
  'Behind the Scenes': { order: 6, label: 'Behind the Scenes' },
  Bloopers: { order: 7, label: 'Bloopers' },
  'Opening Credits': { order: 8, label: 'Opening Credits' },
  Recap: { order: 9, label: 'Recaps' },
  'Sneak Peek': { order: 10, label: 'Sneak Peeks' }
};

/**
 * Groups videos by their TMDB type into dynamic filter options, ordered by relevance.
 * Handles any raw type from TMDB, preserving known priorities while gracefully
 * pluralizing and counting any unexpected or episode/season specific types.
 */
export function buildVideoTypeGroups(videos: TmdbVideoDto[]): VideoTypeGroup[] {
  const counts = new Map<string, number>();
  for (const v of videos) {
    const type = v.type?.trim() || 'Other';
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  if (counts.size <= 1) return [];

  const groups = [...counts.entries()]
    .map(([type, count]) => {
      const meta = KNOWN_VIDEO_TYPE_META[type];
      const label = meta?.label ?? type;
      const order = meta?.order ?? 99;
      return {
        type,
        label,
        count,
        order
      };
    })
    .sort((a, b) => a.order - b.order || b.count - a.count)
    .map(({ type, label, count }) => ({ type, label, count }));

  return [{ type: 'all', label: 'All', count: videos.length }, ...groups];
}

@Component({
  selector: 'app-cast-video-gallery',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cast-video-gallery.component.html',
  styleUrls: ['./cast-video-gallery.component.scss'],
})
export class CastVideoGalleryComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private platform = inject(Platform);
  private backButtonSub: (() => void) | null = null;

  public castList = input<CastMemberVm[]>([]);
  public videos = input<TmdbVideoDto[]>([]);

  public activeVideo = signal<TmdbVideoDto | null>(null);
  public selectedVideoType = signal<string>('all');

  public videoTypeGroups = computed<VideoTypeGroup[]>(() => {
    return buildVideoTypeGroups(this.videos());
  });

  /** Falls back to 'all' when the selected type isn't available (e.g. after navigating to another title). */
  public effectiveVideoType = computed<string>(() => {
    const selected = this.selectedVideoType();
    if (selected === 'all') return 'all';
    return this.videoTypeGroups().some((g) => g.type === selected) ? selected : 'all';
  });

  public filteredVideos = computed<TmdbVideoDto[]>(() => {
    const type = this.effectiveVideoType();
    const list = this.videos();
    if (type === 'all') return list;
    return list.filter((v) => (v.type?.trim() || 'Other') === type);
  });

  public activeVideoEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const vid = this.activeVideo();
    if (!vid || vid.site !== 'YouTube') return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${vid.key}?autoplay=1&rel=0&modestbranding=1`
    );
  });

  public selectVideoType(type: string): void {
    this.selectedVideoType.set(type);
  }

  public onThumbError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('placeholder')) {
      img.src = 'assets/placeholders/placeholder.webp';
    }
  }

  public openPerson(actor: CastMemberVm): void {
    void this.router.navigate(['/person', actor.id]);
  }

  public openVideo(video: TmdbVideoDto): void {
    this.activeVideo.set(video);
    this.setupBackButtonListener();
  }

  public closeVideo(): void {
    this.activeVideo.set(null);
    this.cleanupBackButton();
  }

  private setupBackButtonListener(): void {
    if (this.backButtonSub) return;
    const sub = this.platform.backButton.subscribeWithPriority(9999, () => {
      this.closeVideo();
    });
    this.backButtonSub = (): void => sub.unsubscribe();
  }

  private cleanupBackButton(): void {
    if (this.backButtonSub) {
      this.backButtonSub();
      this.backButtonSub = null;
    }
  }

  ngOnDestroy(): void {
    this.cleanupBackButton();
  }
}
