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
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonToolbar,
  IonIcon,
  IonModal,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  checkmarkDone,
  bookmark,
  informationCircleOutline,
  trashOutline,
  mailOpenOutline,
  sparklesOutline,
  addCircleOutline,
  documentTextOutline,
  imageOutline,
  clipboardOutline,
  cameraOutline,
  albumsOutline,
  listOutline,
  checkbox,
  squareOutline,
  checkboxOutline
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { StorageService, TmdbPayload } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { ExtractionService, ExtractedTitleItem } from '../../core/services/extraction.service';
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

interface SelectedImageState {
  previewUrl: string;
  base64: string;
  mimeType: string;
  name: string;
  sizeText: string;
}

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonToolbar,
    IonIcon,
    IonModal,
    IonSpinner,
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
  private extractionService = inject(ExtractionService);

  // View mode: Deck (swiping card stack) or Batch List (table multi-select)
  public viewMode = signal<'deck' | 'list'>(this.getInitialViewMode());

  // Multi-selection state for Batch List View
  public selectedIds = signal<Set<string>>(new Set());

  // Transient set of IDs hidden optimistically while pending undo toast dismissal
  public pendingIds = signal<Set<string>>(new Set());

  // Gesture dragging state
  public isDragging = signal<boolean>(false);
  public isAnimating = signal<boolean>(false);

  // Ingestion Modal State
  public isImportModalOpen = signal<boolean>(false);
  public importMode = signal<'text' | 'image'>('text');
  public rawText = '';
  public selectedImage = signal<SelectedImageState | null>(null);
  public isProcessing = signal<boolean>(false);
  public processingStatus = signal<string>('Analyzing titles with Gemini AI...');

  public isSubmitDisabled = computed<boolean>(() => {
    if (this.isProcessing()) return true;
    if (this.importMode() === 'text') {
      return this.rawText.trim().length === 0;
    }
    return !this.selectedImage();
  });

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

  // Selection computed helpers for Batch List View
  public isAllSelected = computed<boolean>(() => {
    const active = this.cards();
    if (active.length === 0) return false;
    const selected = this.selectedIds();
    return active.every((c) => selected.has(c.id));
  });

  public selectedCount = computed<number>(() => {
    const active = this.cards();
    const selected = this.selectedIds();
    return active.filter((c) => selected.has(c.id)).length;
  });

  constructor() {
    addIcons({
      close,
      checkmarkDone,
      bookmark,
      informationCircleOutline,
      trashOutline,
      mailOpenOutline,
      sparklesOutline,
      addCircleOutline,
      documentTextOutline,
      imageOutline,
      clipboardOutline,
      cameraOutline,
      albumsOutline,
      listOutline,
      checkbox,
      squareOutline,
      checkboxOutline
    });
  }

  private getInitialViewMode(): 'deck' | 'list' {
    try {
      const saved = localStorage.getItem('cinescope_inbox_view_mode');
      if (saved === 'list' || saved === 'deck') {
        return saved;
      }
    } catch {
      // Non-critical fallback
    }
    return 'deck';
  }

  public setViewMode(mode: 'deck' | 'list'): void {
    this.viewMode.set(mode);
    try {
      localStorage.setItem('cinescope_inbox_view_mode', mode);
    } catch {
      // Non-critical fallback
    }
    void this.triggerHaptic(ImpactStyle.Light);
  }

  private async triggerHaptic(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
    try {
      await Haptics.impact({ style });
    } catch {
      // Graceful no-op on non-native environments
    }
  }

  private get activeCardElement(): HTMLElement | null {
    const first = this.deckCards?.first;
    return first ? first.nativeElement : null;
  }

  // ==========================================
  // VIEW MODE & BATCH SELECTION
  // ==========================================

  public toggleSelectAll(): void {
    void this.triggerHaptic(ImpactStyle.Light);
    if (this.isAllSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.cards().map((c) => c.id)));
    }
  }

  public toggleSelectCard(cardId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    void this.triggerHaptic(ImpactStyle.Light);
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }

  public inlineTriage(card: InboxCardVm, action: 'watchlist' | 'watched' | 'discard', event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    void this.triggerHaptic(ImpactStyle.Light);

    // Clean up selection if this item was checked
    this.selectedIds.update((current) => {
      if (!current.has(card.id)) return current;
      const next = new Set(current);
      next.delete(card.id);
      return next;
    });

    this.commitOrQueueAction(card, action);
  }

  public triageBulk(action: 'watchlist' | 'watched' | 'discard'): void {
    const selected = this.selectedIds();
    const targetCards = this.cards().filter((c) => selected.has(c.id));
    if (targetCards.length === 0) return;

    const count = targetCards.length;
    const targetIds = targetCards.map((c) => c.id);
    const targetEntries = targetCards.map((c) => ({
      tmdbId: c.tmdbId,
      mediaType: c.mediaType
    }));

    // Clear selection
    this.selectedIds.set(new Set());

    // Optimistically hide all targeted items
    this.pendingIds.update((current) => {
      const next = new Set(current);
      for (const id of targetIds) {
        next.add(id);
      }
      return next;
    });

    void this.triggerHaptic(ImpactStyle.Medium);

    const label = action === 'watchlist'
      ? `Moved ${count} item${count > 1 ? 's' : ''} to Watchlist`
      : action === 'watched'
        ? `Marked ${count} item${count > 1 ? 's' : ''} as Watched`
        : `Discarded ${count} item${count > 1 ? 's' : ''}`;

    void this.toast.presentActionWithUndo(
      label,
      () => {
        // UNDO tapped: restore all items to visible array
        this.pendingIds.update((current) => {
          const next = new Set(current);
          for (const id of targetIds) {
            next.delete(id);
          }
          return next;
        });
        void this.triggerHaptic(ImpactStyle.Light);
      },
      () => {
        // Dismissed naturally: commit bulk mutation to RxDB
        if (action === 'watchlist') {
          void this.storage.bulkMoveInbox(targetEntries, 'watchlist');
        } else if (action === 'watched') {
          void this.storage.bulkMoveInbox(targetEntries, 'watched');
        } else {
          void this.storage.bulkDiscardInbox(targetEntries);
        }
        this.pendingIds.update((current) => {
          const next = new Set(current);
          for (const id of targetIds) {
            next.delete(id);
          }
          return next;
        });
      }
    );
  }

  // ==========================================
  // INGESTION MODAL & AI EXTRACTION
  // ==========================================

  public openImportModal(): void {
    this.isImportModalOpen.set(true);
  }

  public closeImportModal(): void {
    if (this.isProcessing()) return;
    this.isImportModalOpen.set(false);
  }

  public setImportMode(mode: 'text' | 'image'): void {
    this.importMode.set(mode);
  }

  public onTextInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.rawText = target?.value ?? '';
  }

  public clearText(): void {
    this.rawText = '';
  }

  public async pasteFromClipboard(): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 0) {
          this.rawText = text.trim();
          await this.toast.presentInfo('Pasted text from clipboard.', 1500);
        } else {
          await this.toast.presentWarning('Clipboard is empty.');
        }
      } else {
        await this.toast.presentWarning('Clipboard permission is not available.');
      }
    } catch {
      await this.toast.presentWarning('Unable to read clipboard. You can paste directly into the box.');
    }
  }

  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    try {
      // Downscale screenshot client-side to ensure base64 remains well below 4.5MB
      const compressed = await this.extractionService.compressImage(file, 1280, 0.82);
      const sizeKb = Math.round((compressed.base64.length * 0.75) / 1024);

      this.selectedImage.set({
        previewUrl: compressed.base64,
        base64: compressed.base64,
        mimeType: compressed.mimeType,
        name: file.name,
        sizeText: `~${sizeKb} KB (optimized)`
      });
    } catch (err) {
      console.error('[InboxPage] Image compression error:', err);
      await this.toast.presentError('Failed to process image file.');
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  public async onDropFile(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      await this.toast.presentWarning('Please drop an image file (PNG, JPG, WEBP).');
      return;
    }

    try {
      const compressed = await this.extractionService.compressImage(file, 1280, 0.82);
      const sizeKb = Math.round((compressed.base64.length * 0.75) / 1024);

      this.selectedImage.set({
        previewUrl: compressed.base64,
        base64: compressed.base64,
        mimeType: compressed.mimeType,
        name: file.name,
        sizeText: `~${sizeKb} KB (optimized)`
      });
    } catch (err) {
      console.error('[InboxPage] Drag-drop compression error:', err);
      await this.toast.presentError('Failed to process dropped image file.');
    }
  }

  public clearImage(): void {
    this.selectedImage.set(null);
  }

  public async submitImport(): Promise<void> {
    if (this.isSubmitDisabled()) return;

    this.isProcessing.set(true);
    this.processingStatus.set('Extracting titles with Gemini AI...');

    try {
      let extracted: ExtractedTitleItem[] = [];

      if (this.importMode() === 'text') {
        extracted = await firstValueFrom(this.extractionService.extractTitles({ text: this.rawText }));
      } else {
        const img = this.selectedImage();
        if (!img) return;
        extracted = await firstValueFrom(
          this.extractionService.extractTitles({
            image: img.base64,
            mimeType: img.mimeType
          })
        );
      }

      if (extracted.length === 0) {
        await this.toast.presentWarning('No movie or TV titles recognized. Try clearer text or another screenshot.');
        this.isProcessing.set(false);
        return;
      }

      this.processingStatus.set(`Resolving ${extracted.length} title${extracted.length > 1 ? 's' : ''} on TMDB...`);

      const result = await this.extractionService.resolveAndQueueTitles(extracted);

      // Reset modal state
      this.rawText = '';
      this.selectedImage.set(null);
      this.isImportModalOpen.set(false);
      this.isProcessing.set(false);

      void this.triggerHaptic(ImpactStyle.Medium);

      if (result.added > 0) {
        await this.toast.presentSuccess(`Successfully queued ${result.added} title${result.added > 1 ? 's' : ''} for triage.`);
      } else if (result.skipped > 0) {
        await this.toast.presentInfo('All recognized titles were already present in your library.');
      } else {
        await this.toast.presentWarning('No titles could be resolved or added.');
      }
    } catch (err) {
      console.error('[InboxPage] Extraction pipeline error:', err);
      this.isProcessing.set(false);
      await this.toast.presentError('Failed to extract titles. Please verify your connection.');
    }
  }

  // ==========================================
  // HARDWARE-ACCELERATED POINTER EVENTS
  // ==========================================

  public onPointerDown(event: PointerEvent): void {
    if (this.isAnimating() || this.cards().length === 0) return;

    const el = this.activeCardElement;
    if (!el) return;

    this.isDragging.set(true);
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.currentX = 0;
    this.currentY = 0;
    this.startTime = Date.now();

    el.setPointerCapture(event.pointerId);
  }

  public onPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) return;

    const el = this.activeCardElement;
    if (!el) return;

    this.currentX = event.clientX - this.startX;
    this.currentY = event.clientY - this.startY;

    const rot = (this.currentX / 16).toFixed(2);
    el.style.setProperty('--tx', `${this.currentX}px`);
    el.style.setProperty('--ty', `${this.currentY}px`);
    el.style.setProperty('--rot', `${rot}deg`);

    // Dynamic stamp opacity
    const rightRatio = Math.min(Math.max(this.currentX / 110, 0), 1);
    const leftRatio = Math.min(Math.max(-this.currentX / 110, 0), 1);
    const upRatio = Math.min(Math.max(-this.currentY / 110, 0), 1);

    el.style.setProperty('--stamp-right', rightRatio.toFixed(2));
    el.style.setProperty('--stamp-left', leftRatio.toFixed(2));
    el.style.setProperty('--stamp-up', upRatio.toFixed(2));
  }

  public onPointerUp(event: PointerEvent): void {
    if (!this.isDragging()) return;

    const el = this.activeCardElement;
    if (el) {
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // Non-critical pointer release
      }
    }

    this.isDragging.set(false);
    this.evaluateDropGesture();
  }

  public onPointerCancel(event: PointerEvent): void {
    this.onPointerUp(event);
  }

  private evaluateDropGesture(): void {
    const el = this.activeCardElement;
    const card = this.cards()[0];
    if (!el || !card) return;

    const elapsed = Math.max(Date.now() - this.startTime, 1);
    const velocityX = Math.abs(this.currentX) / elapsed;
    const velocityY = Math.abs(this.currentY) / elapsed;

    const isFlingX = velocityX > 0.65;
    const isFlingY = velocityY > 0.65;

    // Decision boundaries:
    // 1. Swipe Right (>100px or fling right) -> Watchlist
    // 2. Swipe Left (<-100px or fling left) -> Discard
    // 3. Swipe Up (<-90px or fling up) -> Watched
    if (this.currentY < -90 || (isFlingY && this.currentY < -40)) {
      this.animateExitAndCommit(card, 'watched');
    } else if (this.currentX > 100 || (isFlingX && this.currentX > 40)) {
      this.animateExitAndCommit(card, 'watchlist');
    } else if (this.currentX < -100 || (isFlingX && this.currentX < -40)) {
      this.animateExitAndCommit(card, 'discard');
    } else {
      // Snap back to resting position
      this.animateSnapBack(el);
    }
  }

  private animateSnapBack(el: HTMLElement): void {
    this.isAnimating.set(true);
    el.style.transition = 'transform 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    this.resetTransform(el);

    setTimeout(() => {
      el.style.transition = '';
      this.isAnimating.set(false);
    }, 240);
  }

  public triggerTriage(action: 'watchlist' | 'watched' | 'discard'): void {
    if (this.isAnimating() || this.cards().length === 0) return;
    const card = this.cards()[0];
    if (!card) return;
    void this.triggerHaptic(ImpactStyle.Light);
    this.animateExitAndCommit(card, action);
  }

  private animateExitAndCommit(card: InboxCardVm, action: 'watchlist' | 'watched' | 'discard'): void {
    this.isAnimating.set(true);
    const el = this.activeCardElement;
    void this.triggerHaptic(ImpactStyle.Medium);

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
        void this.triggerHaptic(ImpactStyle.Light);
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
    this.selectedIds.set(new Set());
    const count = await this.storage.clearInbox();
    await this.toast.presentInfo(`Cleared ${count} items from Inbox queue.`);
  }

  // ==========================================
  // DEMO POPULATOR (For quick testing)
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
          overview: 'Cobb, a skilled thief who steals corporate secrets through dream-sharing technology, is given the inverse task of planting an idea into the mind of a CEO.'
        }
      },
      {
        tmdbId: 1396,
        mediaType: 'tv',
        payload: {
          name: 'Breaking Bad',
          poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJAGq.jpg',
          first_air_date: '2008-01-20',
          vote_average: 8.9,
          overview: 'A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student.'
        }
      },
      {
        tmdbId: 438631,
        mediaType: 'movie',
        payload: {
          title: 'Dune',
          poster_path: '/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
          release_date: '2021-09-15',
          vote_average: 7.8,
          overview: 'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe.'
        }
      },
      {
        tmdbId: 119051,
        mediaType: 'tv',
        payload: {
          name: 'Wednesday',
          poster_path: '/9PFonB99qQwygh2ZewTM0nQ94AD.jpg',
          first_air_date: '2022-11-23',
          vote_average: 8.4,
          overview: 'A sleuthing, supernaturally infused mystery charting Wednesday Addams\' years as a student at Nevermore Academy.'
        }
      }
    ];

    for (const item of demoItems) {
      await this.storage.addToInbox(item.tmdbId, item.mediaType, item.payload);
    }

    void this.triggerHaptic(ImpactStyle.Light);
    await this.toast.presentSuccess('Loaded 4 sample titles into Inbox.');
  }

  private toCardVm(doc: ContentDocType): InboxCardVm {
    const p = (doc.payload ?? {}) as Record<string, unknown>;
    const isMovie = doc.mediaType !== 'tv';
    const rawTitle = (isMovie ? p['title'] : p['name']) as string | undefined;
    const title = rawTitle ?? 'Untitled Title';
    const posterPath = (p['poster_path'] as string | undefined) ?? null;
    const posterUrl = resolveMediaImageUrl(posterPath, 'w500');

    const dateStr = (isMovie ? p['release_date'] : p['first_air_date']) as string | undefined;
    const year = dateStr ? dateStr.substring(0, 4) : undefined;
    const voteAvg = p['vote_average'] as number | undefined;
    const rating = voteAvg && voteAvg > 0 ? voteAvg.toFixed(1) : undefined;

    const parts: string[] = [isMovie ? 'Movie' : 'TV Series'];
    if (year) parts.push(year);
    if (rating) parts.push(`★ ${rating}`);
    const metaSubtitle = parts.join(' • ');

    const overview = (p['overview'] as string | undefined) ?? 'No overview available for this candidate.';

    return {
      id: doc.id,
      tmdbId: doc.tmdbId,
      mediaType: doc.mediaType === 'tv' ? 'tv' : 'movie',
      title,
      posterUrl,
      metaSubtitle,
      overview,
      year,
      rating,
      doc
    };
  }
}
