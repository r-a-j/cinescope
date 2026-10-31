import { Injectable, isDevMode } from '@angular/core';
import { createRxDatabase, RxDatabase, addRxPlugin, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration-schema';
import { sha256 } from 'js-sha256';

// Import our Domain Schemas
import { contentSchema, ContentDocType, contentMigrationStrategies } from './schemas/content.schema';
import { settingsSchema, SettingsDocType, settingsMigrationStrategies } from './schemas/settings.schema';
import { searchHistorySchema, SearchHistoryDocType, searchHistoryMigrationStrategies } from './schemas/search-history.schema';
import { tvProgressSchema, TvProgressDocType, tvProgressMigrationStrategies } from './schemas/tv-progress.schema';

// 1. Core Plugins
if (isDevMode()) {
    addRxPlugin(RxDBDevModePlugin);
}
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationPlugin);

// 2. Define our Collections strictly
export interface CinescopeCollections {
    content: RxCollection<ContentDocType>;
    settings: RxCollection<SettingsDocType>;
    searchHistory: RxCollection<SearchHistoryDocType>;
    tvProgress: RxCollection<TvProgressDocType>;
}

export type CinescopeDatabase = RxDatabase<CinescopeCollections>;

@Injectable({
    providedIn: 'root'
})
export class DatabaseService {
    private dbInstance: CinescopeDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    public async initDatabase(): Promise<void> {
        if (this.dbInstance) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async (): Promise<void> => {
            try {
                const baseStorage = getRxStorageDexie();
                const storageWrapper = isDevMode()
                    ? wrappedValidateAjvStorage({ storage: baseStorage })
                    : baseStorage;

                // Determine if we need the pure-JS fallback for Wi-Fi Live Reload.
                let fallbackHash: ((input: string) => Promise<string>) | undefined;

                if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.subtle === 'undefined') {
                    console.warn('⚠️ Native Crypto disabled by OS (likely Live-Reload). Falling back to JS-SHA256.');
                    fallbackHash = (input: string): Promise<string> => Promise.resolve(sha256(input));
                }

                // 2. Create the RxDB Instance cleanly without 'any'
                this.dbInstance = await createRxDatabase<CinescopeCollections>({
                    name: 'cinescopedb',
                    storage: storageWrapper,
                    multiInstance: true,
                    ...(fallbackHash ? { hashFunction: fallbackHash } : {})
                });

                // Mount the Collections
                await this.dbInstance.addCollections({
                    content: {
                        schema: contentSchema,
                        migrationStrategies: contentMigrationStrategies
                    },
                    settings: {
                        schema: settingsSchema,
                        migrationStrategies: settingsMigrationStrategies
                    },
                    searchHistory: {
                        schema: searchHistorySchema,
                        migrationStrategies: searchHistoryMigrationStrategies
                    },
                    tvProgress: {
                        schema: tvProgressSchema,
                        migrationStrategies: tvProgressMigrationStrategies
                    }
                });

                // ==========================================
                // STRATEGIC MILESTONE VERIFICATION
                // ==========================================
                // Ensure default settings exist without overwriting existing user preferences.
                const existingPrefs = await this.dbInstance.settings.findOne('user_preferences').exec();
                if (!existingPrefs) {
                    await this.dbInstance.settings.insert({
                        id: 'user_preferences',
                        allowAdultContent: false,
                        theme: 'system',
                        region: 'IN',
                        isManualRegion: false,
                        appTourCompleted: false
                    });
                }

                const testDoc = await this.dbInstance.settings.findOne('user_preferences').exec();

                console.log('[DatabaseService] Database Write & Read Successful');
                console.log('[DatabaseService] Settings initialized:', testDoc?.toJSON());
                console.log('[DatabaseService] CineScope Database Initialized Successfully');
                // ==========================================

            } catch (error) {
                console.error('CRITICAL: Failed to initialize RxDB instance', error);
                throw error;
            }
        })();

        return this.initPromise;
    }

    public isInitialized(): boolean {
        return this.dbInstance !== null;
    }

    public async getDatabase(): Promise<CinescopeDatabase> {
        if (this.dbInstance) {
            return this.dbInstance;
        }
        await this.initDatabase();
        if (!this.dbInstance) {
            throw new Error('Database initialization failed unexpectedly.');
        }
        return this.dbInstance;
    }

    public get db(): CinescopeDatabase {
        if (!this.dbInstance) {
            throw new Error('Database accessed before initialization completed. Check APP_INITIALIZER.');
        }
        return this.dbInstance;
    }
}