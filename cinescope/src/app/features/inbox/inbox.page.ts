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
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonToolbar,
  IonIcon,
  IonModal,
  IonSpinner,
  AlertController
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
  checkboxOutline,
  closeCircle,
  alertCircleOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { StorageService } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { ExtractionService, ExtractedTitleItem } from '../../core/services/extraction.service';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { resolveMediaImageUrl, DEFAULT_POSTER_PLACEHOLDER } from '../../core/constants/api.constants';

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

export interface SelectedImageItem {
  id: string;
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
  private alertController = inject(AlertController);

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
  public rawText = signal<string>('');
  public selectedImages = signal<SelectedImageItem[]>([]);
  public isProcessing = signal<boolean>(false);
  public processingStatus = signal<string>('Analyzing titles with Gemini AI...');

  public isSubmitDisabled = computed<boolean>(() => {
    if (this.isProcessing()) return true;
    if (this.importMode() === 'text') {
      const len = this.rawText().trim().length;
      return len === 0 || len > 10000;
    }
    return this.selectedImages().length === 0;
  });

  public validationHint = computed<string>(() => {
    if (this.importMode() === 'text') {
      const len = this.rawText().trim().length;
      if (len === 0) return 'Paste or type movie & TV titles above to enable extraction';
      if (len > 10000) return `Input exceeds maximum limit of 10,000 characters (${this.rawText().length} / 10,000)`;
      return `Ready to extract from ${this.rawText().length} characters`;
    }
    const count = this.selectedImages().length;
    if (count === 0) return 'Select or drop up to 5 screenshots above to enable extraction';
    return `Ready to analyze ${count} of 5 screenshot${count > 1 ? 's' : ''}`;
  });

  public validationHintIcon = computed<string>(() => {
    if (this.importMode() === 'text') {
      const len = this.rawText().trim().length;
      if (len === 0) return 'information-circle-outline';
      if (len > 10000) return 'alert-circle-outline';
      return 'checkmark-circle-outline';
    }
    const count = this.selectedImages().length;
    return count > 0 ? 'checkmark-circle-outline' : 'information-circle-outline';
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
      checkboxOutline,
      closeCircle,
      alertCircleOutline,
      checkmarkCircleOutline
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
  }

  private get activeCardElement(): HTMLElement | null {
    const first = this.deckCards?.first;
    return first ? first.nativeElement : null;
  }

  // ==========================================
  // VIEW MODE & BATCH SELECTION
  // ==========================================

  public toggleSelectAll(): void {
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

    // Clean up selection if this item was checked
    this.selectedIds.update((current) => {
      if (!current.has(card.id)) return current;
      const next = new Set(current);
      next.delete(card.id);
      return next;
    });

    void this.commitCardAction(card, action);
  }

  public async triageBulk(action: 'watchlist' | 'watched' | 'discard'): Promise<void> {
    const selected = this.selectedIds();
    const targetCards = this.cards().filter((c) => selected.has(c.id));
    if (targetCards.length === 0) return;

    const count = targetCards.length;
    const targetIds = targetCards.map((c) => c.id);
    const targetEntries = targetCards.map((c) => ({
      tmdbId: c.tmdbId,
      mediaType: c.mediaType
    }));

    if (action === 'discard') {
      const isAll = this.isAllSelected();
      const alert = await this.alertController.create({
        header: isAll ? 'Clear Entire Inbox?' : `Discard ${count} Selected Item${count > 1 ? 's' : ''}?`,
        subHeader: `${count} title${count > 1 ? 's' : ''} will be permanently removed`,
        message: 'All selected unreviewed titles extracted from AI recommendations will be cleared from this queue. This action cannot be undone.',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: isAll ? 'Clear All' : 'Discard',
            role: 'destructive',
            handler: async (): Promise<void> => {
              await this.executeBulkCommit(targetIds, targetEntries, action, count);
            }
          }
        ]
      });
      await alert.present();
      return;
    }

    await this.executeBulkCommit(targetIds, targetEntries, action, count);
  }

  private async executeBulkCommit(
    targetIds: string[],
    targetEntries: { tmdbId: number; mediaType: 'movie' | 'tv' }[],
    action: 'watchlist' | 'watched' | 'discard',
    count: number
  ): Promise<void> {
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

    const label = action === 'watchlist'
      ? `Moved ${count} item${count > 1 ? 's' : ''} to Watchlist`
      : action === 'watched'
        ? `Marked ${count} item${count > 1 ? 's' : ''} as Watched`
        : `Discarded ${count} item${count > 1 ? 's' : ''}`;

    try {
      if (action === 'watchlist') {
        await this.storage.bulkMoveInbox(targetEntries, 'watchlist');
      } else if (action === 'watched') {
        await this.storage.bulkMoveInbox(targetEntries, 'watched');
      } else {
        await this.storage.bulkDiscardInbox(targetEntries);
      }
      await this.toast.presentSuccess(label, 2000);
    } catch (err) {
      console.error('[InboxPage] Bulk action failed:', err);
      await this.toast.presentError('Failed to process bulk action. Please try again.');
    } finally {
      this.pendingIds.update((current) => {
        const next = new Set(current);
        for (const id of targetIds) {
          next.delete(id);
        }
        return next;
      });
    }
  }

  // ==========================================
  // INGESTION MODAL & AI EXTRACTION
  // ==========================================

  public openImportModal(): void {
    this.isImportModalOpen.set(true);
  }

  public closeImportModal(): void {
    this.isImportModalOpen.set(false);
  }

  public setImportMode(mode: 'text' | 'image'): void {
    this.importMode.set(mode);
  }

  public onTextInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    this.rawText.set(target?.value ?? '');
  }

  public clearText(): void {
    this.rawText.set('');
  }

  public async pasteFromClipboard(): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 0) {
          const trimmed = text.trim();
          if (trimmed.length > 10000) {
            this.rawText.set(trimmed.slice(0, 10000));
            await this.toast.presentWarning('Pasted text was truncated to the 10,000 character limit.');
          } else {
            this.rawText.set(trimmed);
            await this.toast.presentInfo('Pasted text from clipboard.', 1500);
          }
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

  public async addFiles(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;

    const current = this.selectedImages();
    const availableSlots = 5 - current.length;

    if (availableSlots <= 0) {
      await this.toast.presentWarning('Maximum of 5 screenshots allowed.');
      return;
    }

    let filesToProcess = files.filter((f) => f.type.startsWith('image/'));
    if (filesToProcess.length === 0) {
      await this.toast.presentWarning('Please select valid image files (PNG, JPG, WEBP).');
      return;
    }

    if (filesToProcess.length > availableSlots) {
      await this.toast.presentWarning(`Only ${availableSlots} more screenshot${availableSlots > 1 ? 's' : ''} can be added (max 5).`);
      filesToProcess = filesToProcess.slice(0, availableSlots);
    }

    const newItems: SelectedImageItem[] = [];
    for (const file of filesToProcess) {
      try {
        const compressed = await this.extractionService.compressImage(file, 1280, 0.82);
        const sizeKb = Math.round((compressed.base64.length * 0.75) / 1024);
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          previewUrl: compressed.base64,
          base64: compressed.base64,
          mimeType: compressed.mimeType,
          name: file.name,
          sizeText: `~${sizeKb} KB`
        });
      } catch (err) {
        console.error('[InboxPage] Compression error for ' + file.name, err);
      }
    }

    if (newItems.length > 0) {
      this.selectedImages.update((list) => [...list, ...newItems]);
    }
  }

  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files || []);
    if (files.length > 0) {
      await this.addFiles(files);
      if (input) input.value = '';
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  public async onDropFile(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length > 0) {
      await this.addFiles(files);
    }
  }

  public removeImage(id: string): void {
    this.selectedImages.update((list) => list.filter((img) => img.id !== id));
  }

  public clearAllImages(): void {
    this.selectedImages.set([]);
  }

  public async submitImport(): Promise<void> {
    if (this.isSubmitDisabled()) return;

    // Snapshot user input
    const mode = this.importMode();
    const textPayload = this.rawText().trim();
    const imagesPayload = [...this.selectedImages()];
    const totalScreenshots = imagesPayload.length;

    // Immediately clear inputs and close modal for responsive background UX
    this.rawText.set('');
    this.selectedImages.set([]);
    this.closeImportModal();

    this.isProcessing.set(true);
    const startMsg = mode === 'text'
      ? 'Extracting titles from notes in background...'
      : `Queued ${totalScreenshots} screenshot(s) for background analysis...`;
    await this.toast.presentInfo(startMsg, 2500);

    try {
      const allExtracted: ExtractedTitleItem[] = [];
      let failedScreenshots = 0;

      if (mode === 'text') {
        this.processingStatus.set('Extracting titles from text with Gemini AI...');
        const res = await firstValueFrom(
          this.extractionService.extractTitles({ text: textPayload })
        );
        if (res && res.length > 0) {
          allExtracted.push(...res);
        }
      } else {
        const total = imagesPayload.length;
        let lastFailureMessage = '';

        for (let i = 0; i < total; i++) {
          const img = imagesPayload[i];
          this.processingStatus.set(`Analyzing screenshot ${i + 1} of ${total}: ${img.name}...`);

          try {
            const extracted = await firstValueFrom(
              this.extractionService.extractTitles({
                image: img.base64,
                mimeType: img.mimeType
              })
            );
            if (extracted && extracted.length > 0) {
              allExtracted.push(...extracted);
            }
          } catch (jobErr) {
            console.error(`[InboxPage] Analysis error for image ${i + 1} (${img.name}):`, jobErr);
            failedScreenshots++;
            lastFailureMessage = this.formatExtractionError(jobErr);
          }

          if (i < total - 1) {
            await new Promise((resolve) => setTimeout(resolve, 350));
          }
        }

        if (allExtracted.length === 0 && failedScreenshots === total) {
          const finalMsg = lastFailureMessage || 'Failed to analyze screenshots. Please try again.';
          await this.toast.presentError(finalMsg, 5000);
          return;
        }
      }

      // Deduplicate titles by name and year
      const titleMap = new Map<string, ExtractedTitleItem>();
      for (const item of allExtracted) {
        const clean = item.title?.trim();
        if (!clean) continue;
        const key = `${clean.toLowerCase()}:${item.year || ''}:${item.mediaType || ''}`;
        if (!titleMap.has(key)) {
          titleMap.set(key, item);
        }
      }
      const uniqueTitles = Array.from(titleMap.values());

      if (uniqueTitles.length === 0) {
        await this.toast.presentWarning('No movie or TV titles recognized. Try clearer text or different screenshots.');
        this.isProcessing.set(false);
        return;
      }

      this.processingStatus.set(`Resolving ${uniqueTitles.length} title${uniqueTitles.length > 1 ? 's' : ''} on TMDB...`);
      const result = await this.extractionService.resolveAndQueueTitles(uniqueTitles);

      // Send notification of findings
      const sourceDesc = mode === 'text'
        ? 'pasted text'
        : `${totalScreenshots} screenshot${totalScreenshots > 1 ? 's' : ''}`;

      const alert = await this.alertController.create({
        header: 'Analysis Findings',
        subHeader: `${uniqueTitles.length} Titles Discovered`,
        message:
          `Batch analysis completed for ${sourceDesc}.\n\n` +
          `• Added to Inbox: ${result.added}\n` +
          (result.skipped > 0 ? `• Already in Collection: ${result.skipped}\n` : '') +
          (failedScreenshots > 0 ? `• Screenshots with errors: ${failedScreenshots}\n` : ''),
        buttons: [
          {
            text: 'Dismiss',
            role: 'cancel'
          },
          {
            text: 'View in Inbox',
            handler: (): void => {
              void this.router.navigateByUrl('/tabs/inbox');
              this.setViewMode('list');
            }
          }
        ]
      });
      await alert.present();

      if (result.added > 0) {
        await this.toast.presentSuccess(`Successfully queued ${result.added} new title${result.added > 1 ? 's' : ''} into Inbox.`);
      }

    } catch (err) {
      console.error('[InboxPage] Extraction pipeline error:', err);
      const userMessage = this.formatExtractionError(err);
      await this.toast.presentError(userMessage, 5000);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private formatExtractionError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const serverError = (err.error as { error?: string } | null)?.error;
      if (typeof serverError === 'string' && serverError.length > 0) {
        return serverError;
      }
      if (err.status === 429) {
        return 'AI rate limit reached. Please wait a minute before trying again.';
      }
      if (err.status === 503) {
        return 'Gemini AI is currently experiencing high demand. Please try again in a moment.';
      }
      if (err.status === 0) {
        return 'Network connection timed out. Please check your internet connection.';
      }
    }

    if (err instanceof Error && err.name === 'TimeoutError') {
      return 'Network connection timed out. Please check your internet connection.';
    }

    return 'Failed to extract titles from AI service. Please try again.';
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

    el.classList.add('dragging');
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
      el.classList.remove('dragging');
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
    el.classList.remove('dragging');
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
    this.animateExitAndCommit(card, action);
  }

  private animateExitAndCommit(card: InboxCardVm, action: 'watchlist' | 'watched' | 'discard'): void {
    this.isAnimating.set(true);
    const el = this.activeCardElement;

    if (el) {
      el.classList.remove('dragging');
      el.classList.add('exiting');
      if (action === 'watchlist') {
        el.style.setProperty('--tx', '140vw');
        el.style.setProperty('--ty', `${this.currentY || 0}px`);
        el.style.setProperty('--rot', '24deg');
        el.style.setProperty('--stamp-right', '1');
      } else if (action === 'discard') {
        el.style.setProperty('--tx', '-140vw');
        el.style.setProperty('--ty', `${this.currentY || 0}px`);
        el.style.setProperty('--rot', '-24deg');
        el.style.setProperty('--stamp-left', '1');
      } else if (action === 'watched') {
        el.style.setProperty('--tx', `${this.currentX || 0}px`);
        el.style.setProperty('--ty', '-140vh');
        el.style.setProperty('--rot', '0deg');
        el.style.setProperty('--stamp-up', '1');
      }
    }

    this.currentX = 0;
    this.currentY = 0;

    setTimeout(() => {
      void this.commitCardAction(card, action);
      this.isAnimating.set(false);
    }, 240);
  }

  private async commitCardAction(card: InboxCardVm, action: 'watchlist' | 'watched' | 'discard'): Promise<void> {
    // 1. Optimistically hide card from visible stack immediately
    this.pendingIds.update((current) => new Set(current).add(card.id));

    try {
      // 2. Commit mutation directly to RxDB immediately
      if (action === 'watchlist') {
        await this.storage.moveInboxToWatchlist(card.tmdbId, card.mediaType);
      } else if (action === 'watched') {
        const moved = await this.storage.moveInboxToWatched(card.tmdbId, card.mediaType);
        if (!moved) {
          await this.toast.presentWarning(`"${card.title}" is not released yet — saved to Watchlist instead`, 2200);
        }
      } else {
        await this.storage.discardFromInbox(card.tmdbId, card.mediaType);
      }
    } catch (err) {
      console.error('[InboxPage] Failed to commit card action:', err);
      await this.toast.presentError('Failed to save card action. Please try again.');
    } finally {
      // 3. Clear from pendingIds ONLY after RxDB has persisted and emitted.
      // This guarantees the card never flashes back on screen.
      this.pendingIds.update((current) => {
        const next = new Set(current);
        next.delete(card.id);
        return next;
      });
    }
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
    const total = this.cards().length;
    if (total === 0) return;

    const alert = await this.alertController.create({
      header: 'Clear Inbox Queue?',
      subHeader: `${total} title${total > 1 ? 's' : ''} will be permanently removed`,
      message: 'All unreviewed titles extracted from AI recommendations will be cleared from this queue. This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: async (): Promise<void> => {
            this.selectedIds.set(new Set());
            const count = await this.storage.clearInbox();
            await this.toast.presentInfo(`Cleared ${count} items from Inbox.`);
          }
        }
      ]
    });

    await alert.present();
  }

  public onPosterError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && img.src !== DEFAULT_POSTER_PLACEHOLDER) {
      img.src = DEFAULT_POSTER_PLACEHOLDER;
    }
  }

  private toCardVm(doc: ContentDocType): InboxCardVm {
    const p = (doc.payload ?? {}) as Record<string, unknown>;
    const isMovie = doc.mediaType !== 'tv';
    const rawTitle = (isMovie ? p['title'] : p['name']) as string | undefined;
    const title = rawTitle ?? 'Untitled Title';
    const posterPath = (p['poster_path'] as string | undefined) ?? null;
    const posterUrl = posterPath ? resolveMediaImageUrl(posterPath, 'w500') : DEFAULT_POSTER_PLACEHOLDER;

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
