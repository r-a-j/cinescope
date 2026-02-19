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
  public restoreProgress$ = new BehaviorSubject<string>('');

  constructor(private tmdbService: TmdbSearchService) { }

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

    let finalWatchlist: ContentModel[] = [];
    let finalWatched: ContentModel[] = [];

    this.restoreProgress$.next('Merging data...');

    if (mode === 'replace') {
      await Preferences.remove({ key: this.WATCHLIST_KEY });
      await Preferences.remove({ key: this.WATCHED_KEY });
      await Preferences.remove({ key: this.SETTINGS_KEY });

      finalWatchlist = incoming.watchlist_contents ?? [];
      finalWatched = incoming.watched_contents ?? [];

      if (incoming.settings) {
        await this.saveSettings(incoming.settings);
      }
    } else {
      const [curWatchlist, curWatched, curSettings] = await Promise.all([
        this.getWatchlist(),
        this.getWatched(),
        this.getSettings(),
      ]);

      finalWatchlist = this.mergeLists(curWatchlist ?? [], incoming.watchlist_contents ?? []);
      finalWatched = this.mergeLists(curWatched ?? [], incoming.watched_contents ?? []);

      await this.saveSettings({ ...(curSettings ?? {} as SettingModel), ...(incoming.settings ?? {}) });
    }

    const allItemsToHydrate = [
      ...finalWatchlist.filter(i => (i.isMovie && !i.title) || (i.isTv && !i.name)),
      ...finalWatched.filter(i => (i.isMovie && !i.title) || (i.isTv && !i.name))
    ];

    if (allItemsToHydrate.length > 0) {
      await this.hydrateItemsWithProgress(allItemsToHydrate);
    } else {
      this.restoreProgress$.next('Finalizing...');
    }

    await this.setList(this.WATCHLIST_KEY, finalWatchlist);
    await this.setList(this.WATCHED_KEY, finalWatched);

    this.emitStorageChanged();
  }

  async restoreFromBackupJson(jsonText: string, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
    const parsed = JSON.parse(jsonText) as BackupModel;
    await this.restoreFromBackupPayload(parsed, mode);
  }

  private async hydrateItemsWithProgress(items: ContentModel[]) {
    const total = items.length;
    let processed = 0;
    const BATCH_SIZE = 5;
    const DELAY_MS = 250;

    console.log(`[Storage] Hydrating ${total} items with progress tracking...`);

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      const tasks = batch.map(async (item) => {
        try {
          if (item.isMovie) {
            const detail = await firstValueFrom(this.tmdbService.getMovieDetail(item.contentId, true));
            item.title = detail.title;
            item.poster_path = detail.poster_path;
            item.vote_average = detail.vote_average;
            item.release_date = detail.release_date;
            item.genres = detail.genres;
          } else if (item.isTv) {
            const detail = await firstValueFrom(this.tmdbService.getTvDetail(item.contentId, true));
            item.name = detail.name;
            item.poster_path = detail.poster_path;
            item.vote_average = detail.vote_average;
            item.first_air_date = detail.first_air_date;
            item.genres = detail.genres;
          }
        } catch (e) {
          console.error(`[Storage] Failed to hydrate item ${item.contentId}`, e);
        }
      });

      await Promise.all(tasks);

      processed += batch.length;
      const percent = Math.min(100, Math.round((processed / total) * 100));
      const msg = `Restoring images: ${percent}% (${processed}/${total})`;

      this.restoreProgress$.next(msg);

      if (i + BATCH_SIZE < total) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
  }

  private async getList(key: string): Promise<ContentModel[]> {
    const { value } = await Preferences.get({ key });
    let list: ContentModel[] = value ? JSON.parse(value) : [];

    const seen = new Set<string>();
    list = list.filter(item => {
      const k = `${item.contentId}-${item.isMovie}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const needsUpdate = list.some(item => (item.isMovie && !item.title) || (item.isTv && !item.name));

    if (needsUpdate) {
      console.log(`[Storage] Hydrating missing data for list: ${key}`);
      await this.hydrateList(list);
      await this.setList(key, list);
    }

    return list;
  }

  private async hydrateList(list: ContentModel[]) {
    const itemsToUpdate = list.filter(item =>
      (item.isMovie && !item.title) || (item.isTv && !item.name)
    );

    if (itemsToUpdate.length > 0) {
      await this.hydrateItemsWithProgress(itemsToUpdate);
    }

    console.log(`[Storage] Starting batch hydration for ${itemsToUpdate.length} items...`);

    const BATCH_SIZE = 5;
    const DELAY_MS = 250;

    for (let i = 0; i < itemsToUpdate.length; i += BATCH_SIZE) {
      const batch = itemsToUpdate.slice(i, i + BATCH_SIZE);

      const tasks = batch.map(async (item) => {
        try {
          if (item.isMovie) {
            const detail = await firstValueFrom(this.tmdbService.getMovieDetail(item.contentId, true));
            item.title = detail.title;
            item.poster_path = detail.poster_path;
            item.vote_average = detail.vote_average;
            item.release_date = detail.release_date;
            item.genres = detail.genres;
          } else if (item.isTv) {
            const detail = await firstValueFrom(this.tmdbService.getTvDetail(item.contentId, true));
            item.name = detail.name;
            item.poster_path = detail.poster_path;
            item.vote_average = detail.vote_average;
            item.first_air_date = detail.first_air_date;
            item.genres = detail.genres;
          }
        } catch (e) {
          console.error(`[Storage] Failed to hydrate item ${item.contentId}`, e);
        }
      });

      await Promise.all(tasks);

      if (i + BATCH_SIZE < itemsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log('[Storage] Hydration complete.');
  }

  private async setList(key: string, list: ContentModel[]): Promise<void> {
    await Preferences.set({ key, value: JSON.stringify(list) });
  }

  async addToWatchlist(content: ContentModel): Promise<void> {
    const watchlist = await this.getList(this.WATCHLIST_KEY);
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
      content.watchedAt = new Date().toISOString();
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
      content.watchedAt = new Date().toISOString();
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