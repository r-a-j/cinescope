import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  ViewChildren,
  QueryList,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonToolbar,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  checkmarkDone,
  bookmark,
  informationCircleOutline,
  trashOutline,
  mailOpenOutline,
  sparklesOutline
} from 'ionicons/icons';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { StorageService, TmdbPayload } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

export interface InboxCardVm {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterUrl: string;
  metaSubtitle: string;
  overview: string;
  year?: string | undefined;
  rating?: string | undefined;
  doc: ContentDocType;
}

interface SampleInboxSeed {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  payload: TmdbPayload;
}

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonToolbar,
    IonIcon,
    HeaderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inbox.page.html',
  styleUrls: ['./inbox.page.scss']
})
export class InboxPage {
  @ViewChildren('deckCard') public deckCards?: QueryList<ElementRef<HTMLElement>>;

  public storage = inject(StorageService);
  private toast = inject(ToastService);
  private router = inject(Router);

  // Transient set of IDs hidden optimistically while pending undo toast dismissal
  public pendingIds = signal<Set<string>>(new Set());

  // Gesture dragging state
  public isDragging = signal<boolean>(false);
  public isAnimating = signal<boolean>(false);

  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private currentX = 0;
  private currentY = 0;

  // Reactive active cards derived from RxDB inboxItems minus pending commits
  public cards = computed<InboxCardVm[]>(() => {
    const rawDocs = this.storage.inboxItems();
    const pending = this.pendingIds();
    return rawDocs
      .filter((doc) => !pending.has(doc.id))
      .map((doc) => this.toCardVm(doc));
  });

  // Display top 3 cards in the deck stack
  public visibleStack = computed<InboxCardVm[]>(() => {
    return this.cards().slice(0, 3);
  });

  constructor() {
    addIcons({
      close,
      checkmarkDone,
      bookmark,
      informationCircleOutline,
      trashOutline,
      mailOpenOutline,
      sparklesOutline
    });
  }

  private get activeCardElement(): HTMLElement | null {
    const first = this.deckCards?.first;
    return first ? first.nativeElement : null;
  }

  // ==========================================
  // 👆 POINTER GESTURE ENGINE
  // ==========================================

  public onPointerDown(event: PointerEvent): void {
    if (this.isAnimating() || this.cards().length === 0) return;

    const el = this.activeCardElement;
    if (el) {
      el.setPointerCapture(event.pointerId);
    }

    this.startX = event.clientX;
    this.startY = event.clientY;
    this.currentX = 0;
    this.currentY = 0;
    this.startTime = Date.now();
    this.isDragging.set(true);

    this.applyTransform(0, 0, 0);
  }

  public onPointerMove(event: PointerEvent): void {
    if (!this.isDragging() || this.isAnimating()) return;

    this.currentX = event.clientX - this.startX;
    this.currentY = event.clientY - this.startY;

    const rot = Math.max(-25, Math.min(25, this.currentX * 0.08));
    this.applyTransform(this.currentX, this.currentY, rot);
  }

  public onPointerUp(event: PointerEvent): void {
    if (!this.isDragging()) return;
    this.isDragging.set(false);

    const el = this.activeCardElement;
    if (el && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }

    const elapsed = Date.now() - this.startTime;
    const dx = this.currentX;
    const dy = this.currentY;

    // Detect click / tap without dragging
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && elapsed < 300) {
      const top = this.cards()[0];
      if (top) {
        this.openDetail(top);
      }
      return;
    }

    const vx = dx / (elapsed || 1);
    const vy = dy / (elapsed || 1);

    // Right swipe -> Watchlist
    if (dx > 95 || (dx > 40 && vx > 0.45)) {
      this.triggerTriage('watchlist');
      return;
    }

    // Left swipe -> Discard
    if (dx < -95 || (dx < -40 && vx < -0.45)) {
      this.triggerTriage('discard');
      return;
    }

    // Up swipe -> Watched (mostly vertical)
    if ((dy < -90 || (dy < -40 && vy < -0.45)) && Math.abs(dx) < 85) {
      this.triggerTriage('watched');
      return;
    }

    // Snap back to center
    this.snapBack();
  }

  public onPointerCancel(event: PointerEvent): void {
    if (!this.isDragging()) return;
    this.isDragging.set(false);
    const el = this.activeCardElement;
    if (el && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    this.snapBack();
  }

  private applyTransform(x: number, y: number, rot: number): void {
    const el = this.activeCardElement;
    if (!el) return;

    el.style.setProperty('--tx', `${x}px`);
    el.style.setProperty('--ty', `${y}px`);
    el.style.setProperty('--rot', `${rot}deg`);

    const rightOpacity = Math.max(0, Math.min(1, (x - 30) / 60));
    const leftOpacity = Math.max(0, Math.min(1, (-x - 30) / 60));
    const upOpacity = (y < -30 && Math.abs(x) < 70) ? Math.max(0, Math.min(1, (-y - 30) / 60)) : 0;

    el.style.setProperty('--stamp-right', String(rightOpacity));
    el.style.setProperty('--stamp-left', String(leftOpacity));
    el.style.setProperty('--stamp-up', String(upOpacity));
  }

  private snapBack(): void {
    const el = this.activeCardElement;
    if (!el) return;

    el.classList.add('exiting');
    this.applyTransform(0, 0, 0);

    setTimeout(() => {
      el.classList.remove('exiting');
    }, 250);
  }

  // ==========================================
  // ⚡ TRIAGE ACTIONS & OPTIMISTIC UNDO
  // ==========================================

  public triggerTriage(action: 'watchlist' | 'watched' | 'discard'): void {
    const list = this.cards();
    if (list.length === 0 || this.isAnimating()) return;

    const card = list[0];
    const el = this.activeCardElement;

    this.isAnimating.set(true);

    if (el) {
      el.classList.add('exiting');
      if (action === 'watchlist') {
        el.style.setProperty('--tx', '150vw');
        el.style.setProperty('--ty', `${this.currentY}px`);
        el.style.setProperty('--rot', '30deg');
        el.style.setProperty('--stamp-right', '1');
      } else if (action === 'discard') {
        el.style.setProperty('--tx', '-150vw');
        el.style.setProperty('--ty', `${this.currentY}px`);
        el.style.setProperty('--rot', '-30deg');
        el.style.setProperty('--stamp-left', '1');
      } else if (action === 'watched') {
        el.style.setProperty('--tx', `${this.currentX}px`);
        el.style.setProperty('--ty', '-150vh');
        el.style.setProperty('--rot', '0deg');
        el.style.setProperty('--stamp-up', '1');
      }
    }

    setTimeout(() => {
      this.commitOrQueueAction(card, action);

      if (el) {
        el.classList.remove('exiting');
        this.resetTransform(el);
      }
      this.isAnimating.set(false);
    }, 280);
  }

  private commitOrQueueAction(card: InboxCardVm, action: 'watchlist' | 'watched' | 'discard'): void {
    // Optimistically hide card from visible stack
    this.pendingIds.update((current) => new Set(current).add(card.id));

    const title = card.title;
    const msg = action === 'watchlist'
      ? `Saved "${title}" to Watchlist`
      : action === 'watched'
        ? `Marked "${title}" as Watched`
        : `Discarded "${title}"`;

    void this.toast.presentActionWithUndo(
      msg,
      () => {
        // UNDO tapped: restore card back to active deck
        this.pendingIds.update((current) => {
          const next = new Set(current);
          next.delete(card.id);
          return next;
        });
      },
      () => {
        // Dismissed naturally: commit mutation to RxDB
        if (action === 'watchlist') {
          void this.storage.moveInboxToWatchlist(card.tmdbId, card.mediaType);
        } else if (action === 'watched') {
          void this.storage.moveInboxToWatched(card.tmdbId, card.mediaType);
        } else {
          void this.storage.discardFromInbox(card.tmdbId, card.mediaType);
        }
        this.pendingIds.update((current) => {
          const next = new Set(current);
          next.delete(card.id);
          return next;
        });
      }
    );
  }

  private resetTransform(el: HTMLElement): void {
    el.style.removeProperty('--tx');
    el.style.removeProperty('--ty');
    el.style.removeProperty('--rot');
    el.style.removeProperty('--stamp-right');
    el.style.removeProperty('--stamp-left');
    el.style.removeProperty('--stamp-up');
    this.currentX = 0;
    this.currentY = 0;
  }

  public openDetail(card?: InboxCardVm): void {
    const target = card ?? this.cards()[0];
    if (!target) return;

    void this.router.navigate(['/media', target.mediaType, target.tmdbId], {
      state: {
        preview: {
          id: target.tmdbId,
          mediaType: target.mediaType,
          title: target.title,
          posterUrl: target.posterUrl
        }
      }
    });
  }

  public async onClearAll(): Promise<void> {
    const count = await this.storage.clearInbox();
    await this.toast.presentInfo(`Cleared ${count} items from Inbox queue.`);
  }

  // ==========================================
  // 🌱 DEMO POPULATOR (For testing Stage 2)
  // ==========================================

  public async populateDemoTitles(): Promise<void> {
    const demoItems: SampleInboxSeed[] = [
      {
        tmdbId: 27205,
        mediaType: 'movie',
        payload: {
          title: 'Inception',
          poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
          release_date: '2010-07-15',
          vote_average: 8.4,
          overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life.',
          genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Sci-Fi' }]
        }
      },
      {
        tmdbId: 693134,
        mediaType: 'movie',
        payload: {
          title: 'Dune: Part Two',
          poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
          release_date: '2024-02-27',
          vote_average: 8.2,
          overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.',
          genres: [{ id: 878, name: 'Sci-Fi' }, { id: 12, name: 'Adventure' }]
        }
      },
      {
        tmdbId: 1396,
        mediaType: 'tv',
        payload: {
          name: 'Breaking Bad',
          poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
          first_air_date: '2008-01-20',
          vote_average: 8.9,
          overview: 'Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and begins manufacturing and selling methamphetamine with a former student.',
          genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }]
        }
      },
      {
        tmdbId: 124800,
        mediaType: 'tv',
        payload: {
          name: 'Severance',
          poster_path: '/1VAM768eA2WuhB9U81s4g4s3i4z.jpg',
          first_air_date: '2022-02-17',
          vote_average: 8.4,
          overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.',
          genres: [{ id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }, { id: 878, name: 'Sci-Fi' }]
        }
      }
    ];

    for (const item of demoItems) {
      await this.storage.addToInbox(item.tmdbId, item.mediaType, item.payload);
    }
    await this.toast.presentSuccess('Loaded 4 demo titles into your Inbox queue.');
  }

  // ==========================================
  // 🛠️ VM CONVERTER
  // ==========================================

  private toCardVm(doc: ContentDocType): InboxCardVm {
    const payload = (doc.payload ?? {}) as Record<string, unknown>;
    const title = String(payload['title'] || payload['name'] || `#${doc.tmdbId}`);
    const rawPath = (payload['poster_path'] || payload['profile_path'] || payload['posterUrl']) as string | undefined;
    const posterUrl = resolveMediaImageUrl(rawPath, 'w780');

    const rawDate = String(payload['release_date'] || payload['first_air_date'] || '');
    const year = rawDate.length >= 4 ? rawDate.slice(0, 4) : undefined;
    const rawRating = Number(payload['vote_average'] || 0);
    const rating = rawRating > 0 ? rawRating.toFixed(1) : undefined;
    const overview = String(payload['overview'] || '');

    const parts: string[] = [doc.mediaType === 'tv' ? 'TV Series' : 'Movie'];
    if (year) parts.push(year);
    if (rating) parts.push(`★ ${rating}`);

    return {
      id: doc.id,
      tmdbId: doc.tmdbId,
      mediaType: doc.mediaType === 'tv' ? 'tv' : 'movie',
      title,
      posterUrl,
      metaSubtitle: parts.join(' • '),
      overview,
      year,
      rating,
      doc
    };
  }
}
