import { Injectable, isDevMode } from '@angular/core';
import { createRxDatabase, RxDatabase, addRxPlugin, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { contentSchema, ContentDocType } from '../app/core/database/content.schema';
import { settingsSchema, SettingsDocType } from '../app/core/database/settings.schema';
import { sha256 } from 'js-sha256';

export type CinescopeCollections = {
  content: RxCollection<ContentDocType>;
  settings: RxCollection<SettingsDocType>;
};

export type CinescopeDatabase = RxDatabase<CinescopeCollections>;

@Injectable({
  providedIn: 'root'
})
export class RxdbService {
  public db!: CinescopeDatabase;

  public async initDb(): Promise<void> {

    // Safely retrieve existing instance if HMR restarted the Angular app
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser && (window as any)['cinescope_rxdb_instance']) {
      this.db = (window as any)['cinescope_rxdb_instance'];
      console.log('[RxDB] Using existing database instance (HMR safe).');
      return;
    }

    addRxPlugin(RxDBJsonDumpPlugin);

    // 1. Defensively request persistent storage from OS/WebView 
    // This dramatically reduces the chance of mobile OS silently clearing our IndexedDB.
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(`[RxDB] Persistent storage granted: ${isPersisted}`);
      } catch (e) {
        console.warn('[RxDB] Persistent storage request failed:', e);
      }
    }

    // 2. Initialize the RxDatabase using the high-performance Dexie storage engine
    this.db = await createRxDatabase<CinescopeCollections>({
      name: 'cinescope_db',
      storage: getRxStorageDexie(),
      multiInstance: true,
      eventReduce: true,
      // Provide an aggressive fallback hash function for Capacitor WebViews 
      // lacking full secure-context WebCrypto API support (Fixes UT8 Error)
      hashFunction: async (str: string) => Promise.resolve(sha256(str))
    });

    // 3. Register our defensive, future-proof schemas
    await this.db.addCollections({
      content: {
        schema: contentSchema
      },
      settings: {
        schema: settingsSchema
      }
    });

    if (isBrowser) {
      (window as any)['cinescope_rxdb_instance'] = this.db;
    }

    console.log('[RxDB] Database initialized safely.');
  }
}
