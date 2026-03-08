import { Injectable, NgZone } from '@angular/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { BehaviorSubject, Observable } from 'rxjs';
import { ContentModel } from 'src/models/content.model';
import { SettingModel } from 'src/models/setting.model';
import { TmdbSearchService } from './tmdb-search.service';
import { RxdbService } from './rxdb.service';
import { ContentDocType } from '../app/core/database/content.schema';

// Zone.js defensive custom operator to ensure UI reactivity
import { OperatorFunction } from 'rxjs';
export function enterZone<T>(zone: NgZone): OperatorFunction<T, T> {
  return (source) => new Observable<T>((subscriber) => {
    return source.subscribe({
      next: (value) => zone.run(() => subscriber.next(value)),
      error: (err) => zone.run(() => subscriber.error(err)),
      complete: () => zone.run(() => subscriber.complete())
    });
  });
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private lastMovedContents: ContentModel[] = [];

  // We keep the original BehaviorSubject as an event bus for legacy component compatibility.
  // We will bridge RxDB's reactive streams into this subject defensively inside the constructor.
  private storageChangedSource = new BehaviorSubject<void>(undefined);
  storageChanged$ = this.storageChangedSource.asObservable();

  public restoreProgress$ = new BehaviorSubject<string>('');

  constructor(
    private tmdbService: TmdbSearchService,
    private rxdb: RxdbService,
    private ngZone: NgZone
  ) {
    // Pipeline RxDB stream directly through NgZone into legacy UI change detection.
    // This allows instant cross-tab reactivity while preventing Angular change-detection failure!
    setTimeout(() => {
      if (this.rxdb.db) {
        this.rxdb.db.collections.content.$.pipe(enterZone(this.ngZone)).subscribe(() => {
          this.emitStorageChanged();
        });
        this.rxdb.db.collections.settings.$.pipe(enterZone(this.ngZone)).subscribe(() => {
          this.emitStorageChanged();
        });
      }
    }, 2000); // Give APP_INITIALIZER a sec to spin up RxDB
  }

  emitStorageChanged() {
    this.storageChangedSource.next();
  }

  // === EXPORT / IMPORT LOGIC WITH RXDB ===

  async exportBackupAndShare(): Promise<{ fileName: string; uri: string }> {
    const contentDump = await this.rxdb.db.collections.content.exportJSON();
    const settingsDump = await this.rxdb.db.collections.settings.exportJSON();

    const payload = {
      version: 2,
      createdAt: new Date().toISOString(),
      app: 'CineScope',
      data: {
        content: contentDump,
        settings: settingsDump
      }
    };

    const json = JSON.stringify(payload, null, 2);
    const fileName = `cinescope-backup-v2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

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
      title: 'CineScope RxDB Backup',
      text: 'Offline fault-tolerant backup for CineScope.',
      files: [uri],
    });

    return { fileName, uri };
  }

  async restoreFromBackupJson(jsonText: string, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
    const parsed = JSON.parse(jsonText);
    await this.restoreFromBackupPayload(parsed, mode);
  }

  async restoreFromBackupPayload(payload: any, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
    if (!payload || !payload.data) throw new Error('Invalid backup format');

    this.restoreProgress$.next('Restoring robust database...');

    if (mode === 'replace') {
      await this.rxdb.db.collections.content.find().remove();
      await this.rxdb.db.collections.settings.find().remove();
    }

    if (payload.version === 2) {
      await this.rxdb.db.collections.content.importJSON(payload.data.content);
      await this.rxdb.db.collections.settings.importJSON(payload.data.settings);
    } else if (payload.version === 1 || !payload.version) {
      await this.restoreLegacyV1Adapter(payload.data);
    }

    this.restoreProgress$.next('Finalizing display...');
    this.emitStorageChanged();
  }

  private async restoreLegacyV1Adapter(incoming: any): Promise<void> {
    const mergedMap = new Map<string, ContentDocType>();
    const mergeItem = (item: any, listName: string) => {
      const mediaType = item.isMovie ? 'movie' : (item.isTv ? 'tv' : 'person');
      const id = `${mediaType}_${item.contentId}`;
      const existing = mergedMap.get(id);
      if (existing) {
        if (!existing.lists.includes(listName)) existing.lists.push(listName);
        if (listName === 'watched' && item.watchedAt) existing.watchedAt = item.watchedAt;
      } else {
        mergedMap.set(id, {
          id,
          tmdbId: item.contentId,
          mediaType,
          lists: [listName],
          addedAt: item.addedAt || new Date().toISOString(),
          watchedAt: listName === 'watched' ? item.watchedAt : undefined,
          payload: item
        });
      }
    };

    if (incoming.watchlist_contents) incoming.watchlist_contents.forEach((i: any) => mergeItem(i, 'watchlist'));
    if (incoming.watched_contents) incoming.watched_contents.forEach((i: any) => mergeItem(i, 'watched'));

    const allContent = Array.from(mergedMap.values());
    if (allContent.length > 0) {
      await this.rxdb.db.collections.content.bulkUpsert(allContent);
    }
    if (incoming.settings) {
      await this.rxdb.db.collections.settings.bulkUpsert([{
        id: 'user_preferences',
        allowAdultContent: incoming.settings.allowAdultContent ?? false,
        theme: incoming.settings.theme ?? 'system'
      }]);
    }
  }

  // === HELPERS & QUERIES ===

  // Mapper transforming RxDB generic documents back into UI-friendly ContentModels.
  private mapToContentModel(doc: ContentDocType): ContentModel {
    return {
      ...(doc.payload as any),
      isWatched: doc.lists.includes('watched'),
      isWatchlist: doc.lists.includes('watchlist'),
      watchedAt: doc.watchedAt
    };
  }

  private async getList(listName: string): Promise<ContentModel[]> {
    const docs = await this.rxdb.db.collections.content.find({
      selector: { lists: { $elemMatch: { $eq: listName } } }
    }).exec();
    return docs.map((d: any) => this.mapToContentModel(d.toJSON()));
  }

  private async upsertItemToList(content: ContentModel, listName: string) {
    const mediaType = content.isMovie ? 'movie' : (content.isTv ? 'tv' : 'person');
    const id = `${mediaType}_${content.contentId}`;

    const existing = await this.rxdb.db.collections.content.findOne({ selector: { id } }).exec();
    if (existing) {
      const doc = existing.toJSON() as ContentDocType;
      if (!doc.lists.includes(listName)) {
        doc.lists.push(listName);
        if (listName === 'watched') doc.watchedAt = new Date().toISOString();
        await this.rxdb.db.collections.content.upsert(doc);
      }
    } else {
      await this.rxdb.db.collections.content.insert({
        id,
        tmdbId: content.contentId,
        mediaType,
        lists: [listName],
        addedAt: new Date().toISOString(),
        watchedAt: listName === 'watched' ? new Date().toISOString() : undefined,
        payload: content
      });
    }
  }

  private async removeItemFromList(contentId: number, isMovie: boolean, isTv: boolean, listName: string) {
    const mediaType = isMovie ? 'movie' : (isTv ? 'tv' : 'person');
    const id = `${mediaType}_${contentId}`;
    const existing = await this.rxdb.db.collections.content.findOne({ selector: { id } }).exec();
    if (existing) {
      const doc = existing.toJSON() as ContentDocType;
      doc.lists = doc.lists.filter(l => l !== listName);
      if (doc.lists.length === 0) {
        await existing.remove(); // Prune completely if orphan
      } else {
        await this.rxdb.db.collections.content.upsert(doc);
      }
    }
  }

  // === API CONTRACT ===

  async getInbox(): Promise<ContentModel[]> { return this.getList('inbox'); }
  async getWatchlist(): Promise<ContentModel[]> { return this.getList('watchlist'); }
  async getWatched(): Promise<ContentModel[]> { return this.getList('watched'); }

  async addToInbox(contents: ContentModel[]): Promise<void> {
    for (const c of contents) await this.upsertItemToList(c, 'inbox');
  }
  async bulkAddToWatchlist(contents: ContentModel[]): Promise<void> {
    for (const c of contents) await this.upsertItemToList(c, 'watchlist');
  }
  async bulkAddToWatched(contents: ContentModel[]): Promise<void> {
    for (const c of contents) await this.upsertItemToList(c, 'watched');
  }

  async addToWatchlist(content: ContentModel): Promise<void> { await this.upsertItemToList(content, 'watchlist'); }
  async addToWatched(content: ContentModel): Promise<void> { await this.upsertItemToList(content, 'watched'); }

  async removeFromInbox(contentId: number, isMovie: boolean, isTv: boolean): Promise<void> {
    await this.removeItemFromList(contentId, isMovie, isTv, 'inbox');
  }
  async bulkRemoveFromInbox(contents: ContentModel[]): Promise<void> {
    for (const c of contents) await this.removeItemFromList(c.contentId, c.isMovie, c.isTv, 'inbox');
  }
  async removeFromWatchlist(contentId: number, isMovie: boolean, isTv: boolean): Promise<void> {
    await this.removeItemFromList(contentId, isMovie, isTv, 'watchlist');
  }
  async removeFromWatched(contentId: number, isMovie: boolean, isTv: boolean): Promise<void> {
    await this.removeItemFromList(contentId, isMovie, isTv, 'watched');
  }

  async bulkRemove(contentIds: number[], isMovie: boolean, isTv: boolean, fromWatchlist: boolean): Promise<void> {
    const listName = fromWatchlist ? 'watchlist' : 'watched';
    for (const id of contentIds) {
      await this.removeItemFromList(id, isMovie, isTv, listName);
    }
  }

  async saveSettings(settings: SettingModel): Promise<void> {
    await this.rxdb.db.collections.settings.upsert({
      id: 'user_preferences',
      allowAdultContent: settings.allowAdultContent,
      theme: settings.theme
    });
  }

  async getSettings(): Promise<SettingModel | null> {
    const doc = await this.rxdb.db.collections.settings.findOne({ selector: { id: 'user_preferences' } }).exec();
    if (doc) {
      const j = doc.toJSON();
      return { allowAdultContent: j.allowAdultContent, theme: j.theme };
    }
    return null;
  }

  async clearAll(): Promise<void> {
    await this.rxdb.db.collections.content.find().remove();
    await this.rxdb.db.collections.settings.find().remove();
  }

  async moveFromWatchlistToWatched(contentId: number, isMovie: boolean, isTv: boolean): Promise<void> {
    const mediaType = isMovie ? 'movie' : (isTv ? 'tv' : 'person');
    const id = `${mediaType}_${contentId}`;
    const existing = await this.rxdb.db.collections.content.findOne({ selector: { id } }).exec();

    if (existing) {
      const doc = existing.toJSON() as ContentDocType;
      doc.lists = doc.lists.filter(l => l !== 'watchlist');
      if (!doc.lists.includes('watched')) doc.lists.push('watched');
      doc.watchedAt = new Date().toISOString();
      await this.rxdb.db.collections.content.upsert(doc);

      const model = this.mapToContentModel(doc);
      this.lastMovedContents = [model];
    }
  }

  async bulkMoveFromWatchlistToWatched(contentIds: number[], isMovie: boolean, isTv: boolean): Promise<void> {
    const mediaType = isMovie ? 'movie' : (isTv ? 'tv' : 'person');
    const moved: ContentModel[] = [];

    for (const cid of contentIds) {
      const id = `${mediaType}_${cid}`;
      const existing = await this.rxdb.db.collections.content.findOne({ selector: { id } }).exec();
      if (existing) {
        const doc = existing.toJSON() as ContentDocType;
        doc.lists = doc.lists.filter(l => l !== 'watchlist');
        if (!doc.lists.includes('watched')) doc.lists.push('watched');
        doc.watchedAt = new Date().toISOString();
        await this.rxdb.db.collections.content.upsert(doc);
        moved.push(this.mapToContentModel(doc));
      }
    }
    this.lastMovedContents = moved;
  }

  async undoLastMove(): Promise<void> {
    for (const item of this.lastMovedContents) {
      const mediaType = item.isMovie ? 'movie' : (item.isTv ? 'tv' : 'person');
      const id = `${mediaType}_${item.contentId}`;
      const existing = await this.rxdb.db.collections.content.findOne({ selector: { id } }).exec();
      if (existing) {
        const doc = existing.toJSON() as ContentDocType;
        doc.lists = doc.lists.filter((l: string) => l !== 'watched');
        if (!doc.lists.includes('watchlist')) doc.lists.push('watchlist');
        await this.rxdb.db.collections.content.upsert(doc);
      }
    }
    this.lastMovedContents = [];
  }
}