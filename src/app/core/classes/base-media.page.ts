import { Directive, inject, ViewChild } from '@angular/core';
import { Platform, IonContent } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StorageService } from 'src/services/storage.service';
import { UnifiedMediaModel } from 'src/models/unified-media.model';

@Directive()
export abstract class BaseMediaPage {
    protected router = inject(Router);
    protected storageService = inject(StorageService);

    protected platform = inject(Platform);
    private backButtonSub: any;

    abstract readonly mediaType: 'movie' | 'tv';
    abstract loadMedia(): Promise<void>;
    abstract navigateToDetail(id: number | string): void;

    segment: 'watchlist' | 'watched' = 'watchlist';
    watchlist: UnifiedMediaModel[] = [];
    watched: UnifiedMediaModel[] = [];

    selectionMode = false;
    selectedIds = new Set<number>();

    filterOpen = false;
    popoverEvent: any = null;
    genres: string[] = [];
    selectedGenres = new Set<string>();

    sortBy: 'default' | 'title' | 'rating' | 'date' = 'default';

    @ViewChild('mainContent', { static: false }) content!: IonContent;

    pressTimer: any;
    wasLongPressed = false;
    private touchStartX = 0;
    private touchStartY = 0;
    protected storageSub!: Subscription;

    ionViewDidEnter() {
        this.loadMedia();
        if (!this.storageSub || this.storageSub.closed) {
            this.storageSub = this.storageService.storageChanged$.subscribe(() => {
                this.loadMedia();
            });
        }

        this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, (processNextHandler) => {
            if (this.selectionMode) {
                this.clearSelection();
            } else {
                processNextHandler();
            }
        });
    }

    ionViewDidLeave() {
        if (this.storageSub) {
            this.storageSub.unsubscribe();
        }
        this.onHoldEnd();
        if (this.backButtonSub) {
            this.backButtonSub.unsubscribe();
        }
    }

    segmentChanged() {
        this.clearSelection();
        if (this.content) {
            this.content.scrollToTop(300);
        }
    }

    onMediaClick(mediaId?: number | string) {
        if (this.wasLongPressed) {
            this.wasLongPressed = false;
            return;
        }
        if (this.selectionMode) {
            this.toggleSelect(Number(mediaId));
        } else {
            this.navigateToDetail(mediaId!);
        }
    }

    onHoldStart(event: Event, contentId: number | string) {
        if (this.selectionMode) return;
        this.wasLongPressed = false;

        if (window.TouchEvent && event instanceof TouchEvent) {
            this.touchStartX = event.touches[0].clientX;
            this.touchStartY = event.touches[0].clientY;
        } else if (event instanceof MouseEvent) {
            this.touchStartX = event.clientX;
            this.touchStartY = event.clientY;
        }

        this.pressTimer = setTimeout(() => {
            this.selectionMode = true;
            this.selectedIds.add(Number(contentId));
            this.wasLongPressed = true;
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    }

    onHoldMove(event: Event) {
        if (!this.pressTimer) return;

        let currentX = 0;
        let currentY = 0;

        if (window.TouchEvent && event instanceof TouchEvent) {
            currentX = event.touches[0].clientX;
            currentY = event.touches[0].clientY;
        } else if (event instanceof MouseEvent) {
            currentX = event.clientX;
            currentY = event.clientY;
        }

        if (Math.abs(currentX - this.touchStartX) > 15 || Math.abs(currentY - this.touchStartY) > 15) {
            this.onHoldEnd();
        }
    }

    onHoldEnd() {
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }
    }

    openFilter(ev: Event) {
        this.popoverEvent = ev;
        this.filterOpen = true;
    }

    toggleGenre(g: string) {
        this.selectedGenres.has(g) ? this.selectedGenres.delete(g) : this.selectedGenres.add(g);
    }

    applyFilter() {
        this.filterOpen = false;
    }

    clearFilter() {
        this.selectedGenres.clear();
        this.sortBy = 'default';
    }

    getCurrentMedia(): UnifiedMediaModel[] {
        const base = this.segment === 'watchlist' ? this.watchlist : this.watched;

        let filtered = base;
        if (this.selectedGenres.size > 0) {
            filtered = base.filter(m => m.genres && m.genres.some(g => this.selectedGenres.has(g.name!)));
        }

        if (this.sortBy === 'default') {
            return filtered;
        }

        return [...filtered].sort((a, b) => {
            if (this.sortBy === 'title') {
                return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
            }
            else if (this.sortBy === 'rating') {
                const diff = (b.vote_average || 0) - (a.vote_average || 0);
                if (diff === 0) {
                    return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
                }
                return diff;
            }
            else if (this.sortBy === 'date') {
                const timeA = a.release_date ? new Date(a.release_date).getTime() : 0;
                const timeB = b.release_date ? new Date(b.release_date).getTime() : 0;
                const safeTimeA = isNaN(timeA) ? 0 : timeA;
                const safeTimeB = isNaN(timeB) ? 0 : timeB;

                const diff = safeTimeB - safeTimeA;
                if (diff === 0) {
                    return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' });
                }
                return diff;
            }
            return 0;
        });
    }

    goToSearch() {
        this.router.navigate(['/search']);
    }

    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        if (!this.selectionMode) {
            this.selectedIds.clear();
        }
    }

    toggleSelect(mediaId: number) {
        if (this.selectedIds.has(mediaId)) {
            this.selectedIds.delete(mediaId);
        } else {
            this.selectedIds.add(mediaId);
        }
    }

    clearSelection() {
        this.selectionMode = false;
        this.selectedIds.clear();
    }

    async removeSelected() {
        const ids = Array.from(this.selectedIds);
        const isMovie = this.mediaType === 'movie';
        const isTv = this.mediaType === 'tv';

        const isWatchlist = this.segment === 'watchlist';
        await this.storageService.bulkRemove(ids, isMovie, isTv, isWatchlist);

        this.clearSelection();
    }

    async moveSelectedToWatched() {
        const ids = Array.from(this.selectedIds);
        const isMovie = this.mediaType === 'movie';
        const isTv = this.mediaType === 'tv';

        await this.storageService.bulkMoveFromWatchlistToWatched(ids, isMovie, isTv);
        this.clearSelection();
    }

    trackById(index: number, item: any) {
        return item.id;
    }
}
