import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, AfterViewInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, GestureController, GestureDetail, Gesture } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
    checkmarkCircleOutline,
    imageOutline,
    close,
    checkmarkDone,
    bookmark,
    star,
    listOutline,
    albumsOutline,
    trashOutline,
    checkmarkDoneOutline,
    bookmarkOutline,
    searchSharp,
    settingsSharp
} from 'ionicons/icons';
import { StorageService } from 'src/services/storage.service';
import { ExtractionService } from 'src/services/extraction.service';
import { ContentModel } from 'src/models/content.model';
import { Subscription, Observable } from 'rxjs';

@Component({
    selector: 'app-inbox',
    templateUrl: './inbox.component.html',
    styleUrls: ['./inbox.component.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
})
export class InboxComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChildren('tinderCard') tinderCards!: QueryList<ElementRef>;

    inboxItems: ContentModel[] = [];
    currentItem: ContentModel | null = null;

    swipeClass: 'swipe-left' | 'swipe-right' | 'swipe-up' | '' = '';
    isAnimating = false;
    viewMode: 'swipe' | 'list' = 'swipe';

    selectedIds = new Set<string>();
    pendingCommitIds = new Set<string>(); // Used to prevent flashing of items mid-toast
    extractionState$!: Observable<{ isExtracting: boolean; text: string }>;

    private storageSub?: Subscription;
    private querySub?: Subscription;
    private cardGesture?: Gesture;

    constructor(
        private storageService: StorageService,
        private extractionService: ExtractionService,
        private toastController: ToastController,
        private gestureCtrl: GestureController,
        private router: Router,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef
    ) {
        addIcons({ checkmarkCircleOutline, imageOutline, close, checkmarkDone, bookmark, star, listOutline, albumsOutline, trashOutline, checkmarkDoneOutline, bookmarkOutline, searchSharp, settingsSharp });
    }

    ngOnInit() {
        this.extractionState$ = this.extractionService.extractionState$;

        this.loadInbox();
        this.storageSub = this.storageService.storageChanged$.subscribe(() => {
            if (!this.isAnimating) {
                this.loadInbox();
            }
        });
    }

    ngOnDestroy() {
        if (this.storageSub) {
            this.storageSub.unsubscribe();
        }

        if (this.querySub) {
            this.querySub.unsubscribe();
        }
    }

    ngAfterViewInit() {
        if (this.tinderCards && this.tinderCards.length > 0 && !this.isAnimating) {
            this.initGesture(this.tinderCards.first);
        }

        this.querySub = this.tinderCards.changes.subscribe((cards) => {
            if (cards.length > 0 && !this.isAnimating) {
                this.initGesture(cards.first);
            } else if (this.cardGesture) {
                this.cardGesture.destroy();
                this.cardGesture = undefined;
            }
        });
    }

    async loadInbox() {
        const fullInbox = await this.storageService.getInbox();
        this.inboxItems = fullInbox.filter(item => !this.pendingCommitIds.has(this.storageService['uniqKey'](item)));
        this.updateCurrentItem();
    }

    updateCurrentItem() {
        if (this.inboxItems.length > 0) {
            this.currentItem = this.inboxItems[0];
        } else {
            this.currentItem = null;
        }
    }

    trackById(index: number, item: ContentModel) {
        return item.contentId + '-' + item.isMovie;
    }

    isNew(item: ContentModel): boolean {
        if (!item.addedAt) return false;
        const added = new Date(item.addedAt).getTime();
        const now = new Date().getTime();
        const hours24 = 24 * 60 * 60 * 1000;
        return (now - added) < hours24;
    }

    toggleSelection(item: ContentModel) {
        const key = this.storageService['uniqKey'](item);
        if (this.selectedIds.has(key)) {
            this.selectedIds.delete(key);
        } else {
            this.selectedIds.add(key);
        }
    }

    selectAll() {
        // ✨ FIX: If ANY items are selected (partially or fully), clear them all.
        if (this.selectedIds.size > 0) {
            this.selectedIds.clear();
        } else {
            // If NOTHING is selected, select everything.
            this.inboxItems.forEach(item => {
                this.selectedIds.add(this.storageService['uniqKey'](item));
            });
        }
    }

    isSelected(item: ContentModel): boolean {
        return this.selectedIds.has(this.storageService['uniqKey'](item));
    }

    getYear(item: ContentModel): string {
        if (item.release_date) {
            return item.release_date.substring(0, 4);
        }
        if (item.first_air_date) {
            return item.first_air_date.substring(0, 4);
        }
        return '';
    }

    async discard(fromGesture: boolean = false) {
        if (this.isAnimating || this.inboxItems.length === 0) return;
        this.isAnimating = true;

        if (!fromGesture) this.swipeClass = 'swipe-left';

        const itemToProcess = this.inboxItems[0];

        // 🚨 1. CAPTURE THE EXACT DOM NODE BEFORE IT DELETES
        const swipedNode = this.tinderCards.first?.nativeElement;

        setTimeout(async () => {
            // 🚨 2. SCRUB IT CLEAN SO IT IS SAFE TO RECYCLE
            if (swipedNode) {
                swipedNode.style.transition = 'none';
                swipedNode.style.transform = '';
            }

            // 3. Now shift the array safely
            this.inboxItems.shift();
            this.updateCurrentItem();
            this.resetAnimationState();

            await this.storageService.removeFromInbox(itemToProcess.contentId, itemToProcess.isMovie, itemToProcess.isTv);
        }, 300);
    }

    async markWatched(fromGesture: boolean = false) {
        if (this.isAnimating || this.inboxItems.length === 0) return;
        this.isAnimating = true;

        if (!fromGesture) this.swipeClass = 'swipe-up';

        const itemToProcess = this.inboxItems[0];

        // 🚨 1. CAPTURE
        const swipedNode = this.tinderCards.first?.nativeElement;

        setTimeout(async () => {
            // 🚨 2. SCRUB
            if (swipedNode) {
                swipedNode.style.transition = 'none';
                swipedNode.style.transform = '';
            }

            this.inboxItems.shift();
            this.updateCurrentItem();
            this.resetAnimationState();

            await this.storageService.addToWatched(itemToProcess);
            await this.storageService.removeFromInbox(itemToProcess.contentId, itemToProcess.isMovie, itemToProcess.isTv);
        }, 300);
    }

    async markWatchlist(fromGesture: boolean = false) {
        if (this.isAnimating || this.inboxItems.length === 0) return;
        this.isAnimating = true;

        if (!fromGesture) this.swipeClass = 'swipe-right';

        const itemToProcess = this.inboxItems[0];

        // 🚨 1. CAPTURE
        const swipedNode = this.tinderCards.first?.nativeElement;

        setTimeout(async () => {
            // 🚨 2. SCRUB
            if (swipedNode) {
                swipedNode.style.transition = 'none';
                swipedNode.style.transform = '';
            }

            this.inboxItems.shift();
            this.updateCurrentItem();
            this.resetAnimationState();

            await this.storageService.addToWatchlist(itemToProcess);
            await this.storageService.removeFromInbox(itemToProcess.contentId, itemToProcess.isMovie, itemToProcess.isTv);
        }, 300);
    }

    private resetAnimationState() {
        this.swipeClass = '';
        this.isAnimating = false;
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'swipe' ? 'list' : 'swipe';
        this.selectedIds.clear();
        if (this.cardGesture) {
            this.cardGesture.enable(this.viewMode === 'swipe');
        }
    }

    goToSearch() {
        this.router.navigate(['/search']);
    }

    goToSetting() {
        this.router.navigate(['/setting']);
    }

    private initGesture(cardElement: ElementRef) {
        if (this.cardGesture) {
            this.cardGesture.destroy();
        }

        const el = cardElement.nativeElement;

        this.cardGesture = this.gestureCtrl.create({
            el,
            gestureName: 'swipe-card',
            gesturePriority: 100,
            threshold: 5,
            direction: 'x',
            maxAngle: 150,

            onStart: () => {
                el.style.transition = 'none';
            },
            onMove: (detail: GestureDetail) => {
                const x = detail.deltaX;
                const y = detail.deltaY;
                const rotation = x / 20;

                el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
            },
            onEnd: (detail: GestureDetail) => {
                this.ngZone.run(() => {
                    const { deltaX: x, deltaY: y, velocityX, velocityY } = detail;
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;

                    const swipeLeft = x < -120 || (velocityX < -0.5 && x < 0);
                    const swipeRight = x > 120 || (velocityX > 0.5 && x > 0);
                    const swipeUp = (y < -120 && Math.abs(x) < 100) || (velocityY < -0.5 && y < 0 && Math.abs(x) < 100);

                    if (swipeLeft || swipeRight || swipeUp) {
                        el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

                        if (swipeUp) {
                            el.style.transform = `translate(${x}px, -${windowHeight}px) rotate(${x / 20}deg)`;
                            this.markWatched(true);
                        } else if (swipeRight) {
                            el.style.transform = `translate(${windowWidth * 1.5}px, ${y + (velocityY * 100)}px) rotate(30deg)`;
                            this.markWatchlist(true);
                        } else if (swipeLeft) {
                            el.style.transform = `translate(-${windowWidth * 1.5}px, ${y + (velocityY * 100)}px) rotate(-30deg)`;
                            this.discard(true);
                        }
                    } else {
                        el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                        el.style.transform = '';
                    }
                });
            }
        });

        this.cardGesture.enable(this.viewMode === 'swipe');
    }

    async discardSelected() {
        if (this.selectedIds.size === 0) return;
        const itemsToProcess = this.inboxItems.filter(item => this.isSelected(item));
        await this.processBulkAction(itemsToProcess, `Discarded ${itemsToProcess.length} items.`, async () => {
            await this.storageService.bulkRemoveFromInbox(itemsToProcess);
        });
    }

    async watchedSelected() {
        if (this.selectedIds.size === 0) return;
        const itemsToProcess = this.inboxItems.filter(item => this.isSelected(item));
        await this.processBulkAction(itemsToProcess, `Moved ${itemsToProcess.length} items to Watched.`, async () => {
            await this.storageService.bulkAddToWatched(itemsToProcess);
            await this.storageService.bulkRemoveFromInbox(itemsToProcess);
        });
    }

    async watchlistSelected() {
        if (this.selectedIds.size === 0) return;
        const itemsToProcess = this.inboxItems.filter(item => this.isSelected(item));
        await this.processBulkAction(itemsToProcess, `Moved ${itemsToProcess.length} items to Watchlist.`, async () => {
            await this.storageService.bulkAddToWatchlist(itemsToProcess);
            await this.storageService.bulkRemoveFromInbox(itemsToProcess);
        });
    }

    private async processBulkAction(items: ContentModel[], toastMessage: string, commitFn: () => Promise<void>) {
        const actionItemIds = items.map(i => this.storageService['uniqKey'](i));

        actionItemIds.forEach(id => this.pendingCommitIds.add(id));

        this.inboxItems = this.inboxItems.filter(item => !actionItemIds.includes(this.storageService['uniqKey'](item)));
        this.selectedIds.clear();
        this.updateCurrentItem();

        const toast = await this.toastController.create({
            message: toastMessage,
            duration: 5000,
            position: 'bottom',
            color: 'dark',
            buttons: [{ text: 'UNDO', role: 'cancel' }]
        });

        await toast.present();
        const { role } = await toast.onDidDismiss();

        if (role === 'cancel') {
            actionItemIds.forEach(id => this.pendingCommitIds.delete(id));

            const fullInbox = await this.storageService.getInbox();

            const restoredItems = fullInbox.filter(item => actionItemIds.includes(this.storageService['uniqKey'](item)));
            const untouchedItems = fullInbox.filter(item => !actionItemIds.includes(this.storageService['uniqKey'](item)) && !this.pendingCommitIds.has(this.storageService['uniqKey'](item)));

            this.inboxItems = [...restoredItems, ...untouchedItems];
            restoredItems.forEach(item => this.selectedIds.add(this.storageService['uniqKey'](item)));
            this.updateCurrentItem();
        } else {
            await commitFn();
            actionItemIds.forEach(id => this.pendingCommitIds.delete(id));
        }
    }
}
