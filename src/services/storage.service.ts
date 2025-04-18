import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject } from 'rxjs';
import { ContentModel } from 'src/models/content.model';
import { SettingModel } from 'src/models/setting.model';

@Injectable({
    providedIn: 'root'
})
export class StorageService {

    private readonly WATCHLIST_KEY = 'watchlist_contents';
    private readonly WATCHED_KEY = 'watched_contents';
    private readonly SETTINGS_KEY = 'settings';
    private lastMovedContents: ContentModel[] = [];

    private storageChangedSource = new BehaviorSubject<void>(undefined);
    storageChanged$ = this.storageChangedSource.asObservable();

    constructor() { }

    emitStorageChanged() {
        this.storageChangedSource.next();
    }

    private async getList(key: string): Promise<ContentModel[]> {
        const { value } = await Preferences.get({ key });
        const list: ContentModel[] = value ? JSON.parse(value) : [];

        // Optional: Deduplicate by contentId
        const uniqueList = Array.from(new Map(list.map((item: ContentModel) => [item.contentId, item])).values());
        return uniqueList;
    }

    private async setList(key: string, list: ContentModel[]): Promise<void> {
        await Preferences.set({ key, value: JSON.stringify(list) });
    }

    // Watchlist Operations
    async addToWatchlist(content: ContentModel): Promise<void> {
        const watchlist = await this.getList(this.WATCHLIST_KEY);
        if (!watchlist.find(c => c.contentId === content.contentId && c.isMovie === content.isMovie && c.isTv === content.isTv)) {
            watchlist.push(content);
            await this.setList(this.WATCHLIST_KEY, watchlist);
        }
        this.emitStorageChanged();
    }

    async removeFromWatchlist(contentId: number, isMovie: boolean, isTv: boolean): Promise<void> {
        const watchlist = await this.getList(this.WATCHLIST_KEY);
        const updated = watchlist.filter(c => !(c.contentId === contentId && c.isMovie === isMovie && c.isTv === isTv));
        await this.setList(this.WATCHLIST_KEY, updated);
        this.emitStorageChanged();
    }

    async getWatchlist(): Promise<ContentModel[]> {
        return this.getList(this.WATCHLIST_KEY);
    }

    // Watched Operations
    async addToWatched(content: ContentModel): Promise<void> {
        const watched = await this.getList(this.WATCHED_KEY);
        if (!watched.find(c => c.contentId === content.contentId && c.isMovie === content.isMovie && c.isTv === content.isTv)) {
            watched.push(content);
            await this.setList(this.WATCHED_KEY, watched);
        }
        this.emitStorageChanged();
    }

    async removeFromWatched(contentId: number, isMovie: boolean, isTv: boolean): Promise<void> {
        const watched = await this.getList(this.WATCHED_KEY);
        const updated = watched.filter(c => !(c.contentId === contentId && c.isMovie === isMovie && c.isTv === isTv));
        await this.setList(this.WATCHED_KEY, updated);
        this.emitStorageChanged();
    }

    async getWatched(): Promise<ContentModel[]> {
        return this.getList(this.WATCHED_KEY);
    }

    // Settings Operations
    async saveSettings(settings: SettingModel): Promise<void> {
        await Preferences.set({
            key: this.SETTINGS_KEY,
            value: JSON.stringify(settings)
        });
        this.emitStorageChanged();
    }

    async getSettings(): Promise<SettingModel | null> {
        const { value } = await Preferences.get({ key: this.SETTINGS_KEY });
        return value ? JSON.parse(value) : null;
    }

    // Utility: Clear Everything
    async clearAll(): Promise<void> {
        await Preferences.clear();
        this.emitStorageChanged();
    }

    // Move from Watchlist to Watched (Single)
    async moveFromWatchlistToWatched(contentId: number, isMovie: boolean, isTv: boolean): Promise<void> {
        const watchlist = await this.getList(this.WATCHLIST_KEY);
        const watched = await this.getList(this.WATCHED_KEY);

        const content = watchlist.find(c => c.contentId === contentId && c.isMovie === isMovie && c.isTv === isTv);
        if (content) {
            await this.removeFromWatchlist(contentId, isMovie, isTv);

            content.isWatched = true;
            content.isWatchlist = false;

            if (!watched.find(w => w.contentId === content.contentId && w.isMovie === content.isMovie && w.isTv === content.isTv)) {
                watched.push(content);
                await this.setList(this.WATCHED_KEY, watched);
            }

            this.lastMovedContents = [content];
        }
        this.emitStorageChanged();
    }

    // Move Bulk from Watchlist to Watched
    async bulkMoveFromWatchlistToWatched(contentIds: number[], isMovie: boolean, isTv: boolean): Promise<void> {
        const watchlist = await this.getList(this.WATCHLIST_KEY);
        const watched = await this.getList(this.WATCHED_KEY);

        const moving = watchlist.filter(c => contentIds.includes(c.contentId) && c.isMovie === isMovie && c.isTv === isTv);

        if (moving.length > 0) {
            const updatedWatchlist = watchlist.filter(c => !contentIds.includes(c.contentId));

            const updatedWatched = [
                ...watched,
                ...moving.map(c => ({ ...c, isWatched: true, isWatchlist: false }))
            ];

            await this.setList(this.WATCHLIST_KEY, updatedWatchlist);
            await this.setList(this.WATCHED_KEY, updatedWatched);

            this.lastMovedContents = moving;
        }
        this.emitStorageChanged();
    }

    // Undo Last Move
    async undoLastMove(): Promise<void> {
        if (this.lastMovedContents.length > 0) {
            const watchlist = await this.getList(this.WATCHLIST_KEY);
            const watched = await this.getList(this.WATCHED_KEY);

            const updatedWatched = watched.filter(w =>
                !this.lastMovedContents.some(m => m.contentId === w.contentId)
            );

            const restored = this.lastMovedContents.map(c => ({
                ...c,
                isWatched: false,
                isWatchlist: true
            }));

            await this.setList(this.WATCHED_KEY, updatedWatched);
            await this.setList(this.WATCHLIST_KEY, [...watchlist, ...restored]);

            this.lastMovedContents = [];
            this.emitStorageChanged();
        }
    }
}


// // USAGE:

// // Add a movie to Watchlist
// await this.storageService.addToWatchlist({
//     id: 1,
//     contentId: 10101,
//     isMovie: true,
//     isTv: false,
//     isWatched: false,
//     isWatchlist: true
//   });
  
//   // Add a movie to Watched
//   await this.storageService.addToWatched({
//     id: 2,
//     contentId: 10102,
//     isMovie: true,
//     isTv: false,
//     isWatched: true,
//     isWatchlist: false
//   });
  
//   // Get watchlist
//   const watchlist = await this.storageService.getWatchlist();
  
//   // Get watched
//   const watched = await this.storageService.getWatched();
  

// // toast saying "Moved to Watched"

// import { ToastController } from '@ionic/angular';

// constructor(private toastController: ToastController) {}

// async presentToast(message: string) {
//   const toast = await this.toastController.create({
//     message,
//     duration: 1500,
//     position: 'bottom',
//     color: 'success'
//   });
//   toast.present();
// }

// Usage:
// await this.presentToast('Moved to Watched!');


// You can show a small toast with an Undo button immediately after moving
// async presentUndoToast() {
//     const toast = await this.toastController.create({
//       message: 'Moved to Watched',
//       duration: 3000,
//       position: 'bottom',
//       buttons: [
//         {
//           text: 'Undo',
//           role: 'cancel',
//           handler: async () => {
//             await this.storageService.undoLastMove();
//             await this.presentToast('Undo successful!');
//           }
//         }
//       ]
//     });
//     toast.present();
//   }
  