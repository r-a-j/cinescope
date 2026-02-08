import { Injectable } from '@angular/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { BackupModel } from 'src/models/backup.model';
import { ContentModel } from 'src/models/content.model';
import { SettingModel } from 'src/models/setting.model';
import { TmdbSearchService } from './tmdb-search.service';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly WATCHLIST_KEY = 'watchlist_contents';
  private readonly WATCHED_KEY = 'watched_contents';
  private readonly SETTINGS_KEY = 'settings';
  private lastMovedContents: ContentModel[] = [];

  private storageChangedSource = new BehaviorSubject<void>(undefined);
  storageChanged$ = this.storageChangedSource.asObservable();

  constructor(private tmdbService: TmdbSearchService) {}

  emitStorageChanged() {
    this.storageChangedSource.next();
  }
  
  private async buildBackupObject(): Promise<BackupModel> {
    const [watchlist, watched, settings] = await Promise.all([
      this.getWatchlist(),
      this.getWatched(),
      this.getSettings(),
    ]);
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      app: 'CineScope',
      data: {
        watchlist_contents: watchlist ?? [],
        watched_contents: watched ?? [],
        settings: settings ?? null,
      },
    };
  }
  
  private uniqKey(c: ContentModel) {
    return `${c.contentId}|${c.isMovie ? 'm' : ''}|${c.isTv ? 't' : ''}`;
  }

  private mergeLists(a: ContentModel[], b: ContentModel[]): ContentModel[] {
    const map = new Map<string, ContentModel>();
    for (const item of [...(a ?? []), ...(b ?? [])]) {
      map.set(this.uniqKey(item), item);
    }
    return Array.from(map.values());
  }
  
async exportBackupAndShare(): Promise<{ fileName: string; uri: string }> {
  const payload = await this.buildBackupObject();
  const json = JSON.stringify(payload, null, 2);

  const fileName = `cinescope-backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}.json`;
  
  await Filesystem.writeFile({
    path: fileName,
    directory: Directory.Cache,
    data: json,
    encoding: Encoding.UTF8,
  });
  
  const { uri } = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });
  
  await Share.share({
    title: 'CineScope Backup',
    text: 'Backup file for your CineScope data.',
    files: [uri],
  });

  return { fileName, uri };
}

async restoreFromBackupPayload(
  payload: BackupModel,
  mode: 'merge' | 'replace' = 'merge'
): Promise<void> {
  if (!payload || payload.version !== 1 || !payload.data) {
    throw new Error('Invalid backup format');
  }

  const incoming = payload.data;

  if (mode === 'replace') {
    await Preferences.remove({ key: this.WATCHLIST_KEY });
    await Preferences.remove({ key: this.WATCHED_KEY });
    await Preferences.remove({ key: this.SETTINGS_KEY });
    await this.setList(this.WATCHLIST_KEY, incoming.watchlist_contents ?? []);
    await this.setList(this.WATCHED_KEY, incoming.watched_contents ?? []);
    if (incoming.settings) {
      await this.saveSettings(incoming.settings);
    }
  } else {    
    const [curWatchlist, curWatched, curSettings] = await Promise.all([
      this.getWatchlist(),
      this.getWatched(),
      this.getSettings(),
    ]);

    const mergedWatchlist = this.mergeLists(curWatchlist ?? [], incoming.watchlist_contents ?? []);
    const mergedWatched  = this.mergeLists(curWatched ?? [], incoming.watched_contents ?? []);

    await this.setList(this.WATCHLIST_KEY, mergedWatchlist);
    await this.setList(this.WATCHED_KEY, mergedWatched);
    await this.saveSettings({ ...(curSettings ?? {} as SettingModel), ...(incoming.settings ?? {}) });
  }

  this.emitStorageChanged();
}

async restoreFromBackupJson(jsonText: string, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
  const parsed = JSON.parse(jsonText) as BackupModel;
  await this.restoreFromBackupPayload(parsed, mode);
}

  /**
   * Retrieves the list and performs "lazy hydration" if items are missing critical display data.
   */
  private async getList(key: string): Promise<ContentModel[]> {
    const { value } = await Preferences.get({ key });
    let list: ContentModel[] = value ? JSON.parse(value) : [];
    
    // De-duplicate first
    list = Array.from(
      new Map(list.map((item: ContentModel) => [item.contentId, item])).values() // Bug fix here: Map key should probably include type, but ID is usually safe enough per list type. Better to be safe: using ID is OK for now as lists are usually type specific but mixed lists might have ID collisions if Movie ID == TV ID.
      // Actually, TMDB IDs can collide between Movie and TV. 
      // Let's use uniqKey logic if we can, but uniqKey uses private method.
      // Re-implementing simplified distinct logic:
    );
     // Distinct by ID+Type
    const seen = new Set<string>();
    list = list.filter(item => {
        const k = `${item.contentId}-${item.isMovie}`;
        if(seen.has(k)) return false;
        seen.add(k);
        return true;
    });

    // LAZY HYDRATION: Check if we have items without titles/names
    const needsUpdate = list.some(item => (item.isMovie && !item.title) || (item.isTv && !item.name));

    if (needsUpdate) {
        console.log(`[Storage] Hydrating missing data for list: ${key}`);
        await this.hydrateList(list);
        // Save the hydrated list back to storage so we don't do this next time
        await this.setList(key, list);
    }

    return list;
  }

  private async hydrateList(list: ContentModel[]) {
    // Process in batches or parallel? Parallel is fine for small lists, but safeguard for large ones?
    // Let's just do Promise.all for now, typically user lists aren't massive.
    
    const tasks = list.map(async (item) => {
        // Skip if already has data
        if ((item.isMovie && item.title) || (item.isTv && item.name)) return;

        try {
            if (item.isMovie) {
                const detail = await firstValueFrom(this.tmdbService.getMovieDetail(item.contentId));
                item.title = detail.title;
                item.poster_path = detail.poster_path;
                item.vote_average = detail.vote_average;
                item.release_date = detail.release_date;
                item.genres = detail.genres;
            } else if (item.isTv) {
                const detail = await firstValueFrom(this.tmdbService.getTvDetail(item.contentId));
                item.name = detail.name;
                item.poster_path = detail.poster_path;
                item.vote_average = detail.vote_average;
                item.first_air_date = detail.first_air_date;
                item.genres = detail.genres;
            }
        } catch (e) {
            console.error(`[Storage] Failed to hydrate item ${item.contentId}`, e);
            // Keep item as is, maybe retry next time
        }
    });

    await Promise.all(tasks);
  }

  private async setList(key: string, list: ContentModel[]): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(list) });
  }

  async addToWatchlist(content: ContentModel): Promise<void> {
    const watchlist = await this.getList(this.WATCHLIST_KEY);
    // Use proper find logic
    if (
      !watchlist.find(
        (c) =>
          c.contentId === content.contentId &&
          c.isMovie === content.isMovie &&
          c.isTv === content.isTv
      )
    ) {
      watchlist.push(content);
      await this.setList(this.WATCHLIST_KEY, watchlist);
    }
    this.emitStorageChanged();
  }

  async removeFromWatchlist(
    contentId: number,
    isMovie: boolean,
    isTv: boolean
  ): Promise<void> {
    const watchlist = await this.getList(this.WATCHLIST_KEY);
    const updated = watchlist.filter(
      (c) =>
        !(c.contentId === contentId && c.isMovie === isMovie && c.isTv === isTv)
    );
    await this.setList(this.WATCHLIST_KEY, updated);
    this.emitStorageChanged();
  }

  async getWatchlist(): Promise<ContentModel[]> {
    return this.getList(this.WATCHLIST_KEY);
  }
  
  async addToWatched(content: ContentModel): Promise<void> {
    const watched = await this.getList(this.WATCHED_KEY);
    if (
      !watched.find(
        (c) =>
          c.contentId === content.contentId &&
          c.isMovie === content.isMovie &&
          c.isTv === content.isTv
      )
    ) {
      watched.push(content);
      await this.setList(this.WATCHED_KEY, watched);
    }
    this.emitStorageChanged();
  }

  async removeFromWatched(
    contentId: number,
    isMovie: boolean,
    isTv: boolean
  ): Promise<void> {
    const watched = await this.getList(this.WATCHED_KEY);
    const updated = watched.filter(
      (c) =>
        !(c.contentId === contentId && c.isMovie === isMovie && c.isTv === isTv)
    );
    await this.setList(this.WATCHED_KEY, updated);
    this.emitStorageChanged();
  }

  async getWatched(): Promise<ContentModel[]> {
    return this.getList(this.WATCHED_KEY);
  }
  
  async saveSettings(settings: SettingModel): Promise<void> {
    await Preferences.set({
      key: this.SETTINGS_KEY,
      value: JSON.stringify(settings),
    });
    this.emitStorageChanged();
  }

  async getSettings(): Promise<SettingModel | null> {
    const { value } = await Preferences.get({ key: this.SETTINGS_KEY });
    return value ? JSON.parse(value) : null;
  }
  
  async clearAll(): Promise<void> {
    await Preferences.clear();
    this.emitStorageChanged();
  }
  
  async moveFromWatchlistToWatched(
    contentId: number,
    isMovie: boolean,
    isTv: boolean
  ): Promise<void> {
    const watchlist = await this.getList(this.WATCHLIST_KEY);
    const watched = await this.getList(this.WATCHED_KEY);

    const content = watchlist.find(
      (c) =>
        c.contentId === contentId && c.isMovie === isMovie && c.isTv === isTv
    );
    if (content) {
      await this.removeFromWatchlist(contentId, isMovie, isTv);

      content.isWatched = true;
      content.isWatchlist = false;

      if (
        !watched.find(
          (w) =>
            w.contentId === content.contentId &&
            w.isMovie === content.isMovie &&
            w.isTv === content.isTv
        )
      ) {
        watched.push(content);
        await this.setList(this.WATCHED_KEY, watched);
      }

      this.lastMovedContents = [content];
    }
    this.emitStorageChanged();
  }
  
  async bulkMoveFromWatchlistToWatched(
    contentIds: number[],
    isMovie: boolean,
    isTv: boolean
  ): Promise<void> {
    const watchlist = await this.getList(this.WATCHLIST_KEY);
    const watched = await this.getList(this.WATCHED_KEY);

    const moving = watchlist.filter(
      (c) =>
        contentIds.includes(c.contentId) &&
        c.isMovie === isMovie &&
        c.isTv === isTv
    );

    if (moving.length > 0) {
      const updatedWatchlist = watchlist.filter(
        (c) => !contentIds.includes(c.contentId)
      );

      const updatedWatched = [
        ...watched,
        ...moving.map((c) => ({ ...c, isWatched: true, isWatchlist: false })),
      ];

      await this.setList(this.WATCHLIST_KEY, updatedWatchlist);
      await this.setList(this.WATCHED_KEY, updatedWatched);

      this.lastMovedContents = moving;
    }
    this.emitStorageChanged();
  }
  
  async undoLastMove(): Promise<void> {
    if (this.lastMovedContents.length > 0) {
      const watchlist = await this.getList(this.WATCHLIST_KEY);
      const watched = await this.getList(this.WATCHED_KEY);

      const updatedWatched = watched.filter(
        (w) => !this.lastMovedContents.some((m) => m.contentId === w.contentId)
      );

      const restored = this.lastMovedContents.map((c) => ({
        ...c,
        isWatched: false,
        isWatchlist: true,
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
  