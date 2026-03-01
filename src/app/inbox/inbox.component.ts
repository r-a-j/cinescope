import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
    checkmarkCircleOutline,
    imageOutline,
    close,
    checkmarkDone,
    bookmark,
    star
} from 'ionicons/icons';
import { StorageService } from 'src/services/storage.service';
import { ContentModel } from 'src/models/content.model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-inbox',
    templateUrl: './inbox.component.html',
    styleUrls: ['./inbox.component.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
})
export class InboxComponent implements OnInit, OnDestroy {
    inboxItems: ContentModel[] = [];
    currentItem: ContentModel | null = null;

    swipeClass: 'swipe-left' | 'swipe-right' | 'swipe-up' | '' = '';
    isAnimating = false;

    private storageSub?: Subscription;

    constructor(private storageService: StorageService) {
        addIcons({ checkmarkCircleOutline, imageOutline, close, checkmarkDone, bookmark, star });
    }

    ngOnInit() {
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
    }

    async loadInbox() {
        this.inboxItems = await this.storageService.getInbox();
        this.updateCurrentItem();
    }

    updateCurrentItem() {
        if (this.inboxItems.length > 0) {
            this.currentItem = this.inboxItems[0];
        } else {
            this.currentItem = null;
        }
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

    async discard() {
        if (this.isAnimating || !this.currentItem) return;

        this.swipeClass = 'swipe-left';
        this.isAnimating = true;

        const itemToRemove = this.currentItem;

        setTimeout(async () => {
            await this.storageService.removeFromInbox(itemToRemove.contentId, itemToRemove.isMovie, itemToRemove.isTv);
            this.resetAnimationState();
        }, 250);
    }

    async markWatched() {
        if (this.isAnimating || !this.currentItem) return;

        this.swipeClass = 'swipe-up';
        this.isAnimating = true;

        const itemToProcess = this.currentItem;

        setTimeout(async () => {
            await this.storageService.addToWatched(itemToProcess);
            await this.storageService.removeFromInbox(itemToProcess.contentId, itemToProcess.isMovie, itemToProcess.isTv);
            this.resetAnimationState();
        }, 250);
    }

    async markWatchlist() {
        if (this.isAnimating || !this.currentItem) return;

        this.swipeClass = 'swipe-right';
        this.isAnimating = true;

        const itemToProcess = this.currentItem;

        setTimeout(async () => {
            await this.storageService.addToWatchlist(itemToProcess);
            await this.storageService.removeFromInbox(itemToProcess.contentId, itemToProcess.isMovie, itemToProcess.isTv);
            this.resetAnimationState();
        }, 250);
    }

    private resetAnimationState() {
        this.swipeClass = '';
        this.isAnimating = false;
        this.loadInbox();
    }
}
