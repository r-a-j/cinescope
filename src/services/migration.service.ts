import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { RxdbService } from './rxdb.service';
import { ContentDocType } from '../app/core/database/content.schema';

@Injectable({
  providedIn: 'root'
})
export class MigrationService {
  constructor(private rxdb: RxdbService) {}

  public async runMigration(): Promise<void> {
    const { value: isComplete } = await Preferences.get({ key: 'rxdb_migration_complete' });
    if (isComplete === 'true') {
      return; // Already migrated
    }

    console.log('[Migration] Starting defensive legacy V1 migration to RxDB...');
    const [watchlist, watched, inbox, settingsStr] = await Promise.all([
      Preferences.get({ key: 'watchlist_contents' }),
      Preferences.get({ key: 'watched_contents' }),
      Preferences.get({ key: 'inbox_contents' }),
      Preferences.get({ key: 'settings' })
    ]);

    const mergedMap = new Map<string, ContentDocType>();

    const mergeItem = (item: any, listName: string) => {
      // Create a unique composite id avoiding media type collisions (e.g. 'movie_123', 'tv_123')
      const mediaType = item.isMovie ? 'movie' : (item.isTv ? 'tv' : 'person');
      const id = `${mediaType}_${item.contentId}`;
      
      const existing = mergedMap.get(id);
      if (existing) {
        if (!existing.lists.includes(listName)) {
           existing.lists.push(listName);
        }
        if (listName === 'watched' && item.watchedAt) {
           existing.watchedAt = item.watchedAt;
        }
      } else {
        mergedMap.set(id, {
          id,
          tmdbId: item.contentId,
          mediaType,
          lists: [listName],
          addedAt: item.addedAt || new Date().toISOString(),
          watchedAt: listName === 'watched' ? item.watchedAt : undefined,
          payload: item // Schemaless TMDB DTO payload wrapper
        });
      }
    };

    if (watchlist.value) {
      try {
        const parsed = JSON.parse(watchlist.value);
        if (Array.isArray(parsed)) parsed.forEach(item => mergeItem(item, 'watchlist'));
      } catch (e) { console.error('[Migration] Failed to parse watchlist V1 data', e); }
    }

    if (watched.value) {
      try {
        const parsed = JSON.parse(watched.value);
        if (Array.isArray(parsed)) parsed.forEach(item => mergeItem(item, 'watched'));
      } catch (e) { console.error('[Migration] Failed to parse watched V1 data', e); }
    }

    if (inbox.value) {
      try {
        const parsed = JSON.parse(inbox.value);
        if (Array.isArray(parsed)) parsed.forEach(item => mergeItem(item, 'inbox'));
      } catch (e) { console.error('[Migration] Failed to parse inbox V1 data', e); }
    }

    const allContent = Array.from(mergedMap.values());
    
    // Idempotent mass-insertion safely handles crash recoveries.
    if (allContent.length > 0) {
      await this.rxdb.db.collections['content'].bulkUpsert(allContent);
      console.log(`[Migration] Safely bulkUpserted ${allContent.length} content documents.`);
    }

    if (settingsStr.value) {
      try {
        const parsed = JSON.parse(settingsStr.value);
        await this.rxdb.db.collections['settings'].bulkUpsert([{
           id: 'user_preferences',
           allowAdultContent: parsed.allowAdultContent ?? false,
           theme: parsed.theme ?? 'system'
        }]);
        console.log(`[Migration] Safely bulkUpserted user settings.`);
      } catch (e) { console.error('[Migration] Failed to parse settings V1 data', e); }
    }

    // CRITICAL: Only set completion flag AFTER the entire bulkUpsert sequence is 100% resolved
    await Preferences.set({ key: 'rxdb_migration_complete', value: 'true' });
    console.log('[Migration] Migration fully completed. Flag permanently set.');
  }
}
