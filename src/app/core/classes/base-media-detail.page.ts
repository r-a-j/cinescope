import { Directive, inject } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { NavController } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { StorageService } from 'src/services/storage.service';
import { ContentModel } from 'src/models/content.model';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Directive()
export abstract class BaseMediaDetailPage {
    protected storageService = inject(StorageService);
    protected toastController = inject(ToastController);
    protected navCtrl = inject(NavController);

    private isTogglingBookmark = false;

    abstract readonly mediaType: 'movie' | 'tv';
    abstract mediaId: number | null;
    abstract createContentModel(): ContentModel;

    bookmarkIcon: string = 'assets/bookmark-empty.svg';
    safeYoutubeUrl: SafeResourceUrl | null = null;
    isScrolled = false;

    isInWatchlist: boolean = false;
    isInWatched: boolean = false;
    bookmarkColor: 'danger' | 'success' | 'medium' = 'medium';

    goBack(): void {
        this.navCtrl.back();
    }

    onScroll(event: any) {
        const scrollTop = event.detail.scrollTop;
        this.isScrolled = scrollTop > 150;
    }

    async refreshBookmarkState() {
        if (!this.mediaId) return;

        const id = this.mediaId;
        const isMovie = this.mediaType === 'movie';
        const isTv = this.mediaType === 'tv';

        const watchlist = await this.storageService.getWatchlist();
        const watched = await this.storageService.getWatched();

        this.isInWatchlist = !!watchlist.find(c => c.contentId === id && ((isMovie && c.isMovie) || (isTv && c.isTv)));
        this.isInWatched = !!watched.find(c => c.contentId === id && ((isMovie && c.isMovie) || (isTv && c.isTv)));

        if (this.isInWatched) {
            this.bookmarkIcon = 'assets/bookmark-watched.svg';
        } else if (this.isInWatchlist) {
            this.bookmarkIcon = 'assets/bookmark-watchlist.svg';
        } else {
            this.bookmarkIcon = 'assets/bookmark-empty.svg';
        }
    }

    async toggleBookmarkState() {
        if (!this.mediaId || this.isTogglingBookmark) return;

        await Haptics.impact({ style: ImpactStyle.Light });

        this.isTogglingBookmark = true;

        try {
            const id = this.mediaId;
            const isMovie = this.mediaType === 'movie';
            const isTv = this.mediaType === 'tv';

            if (this.isInWatched) {
                await this.storageService.removeFromWatched(id, isMovie, isTv);
                this.isInWatched = false;
                this.isInWatchlist = false;
            }
            else if (this.isInWatchlist) {
                await this.storageService.moveFromWatchlistToWatched(id, isMovie, isTv);
                this.isInWatched = true;
                this.isInWatchlist = false;
            }
            else {
                const content = this.createContentModel();
                await this.storageService.addToWatchlist(content);
                this.isInWatchlist = true;
                this.isInWatched = false;
            }

            await this.refreshBookmarkState();
            this.storageService.emitStorageChanged();

        } finally {
            this.isTogglingBookmark = false;
        }
    }

    async showToast(message: string, color: 'success' | 'danger') {
        const toast = await this.toastController.create({
            message,
            duration: 2000,
            position: 'bottom',
            color
        });
        toast.present();
    }

    trackById(index: number, item: any) {
        return item.id;
    }
}
