import { Injectable, isDevMode } from '@angular/core';
import { createRxDatabase, RxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

// 1. Add DevMode dynamically
if (isDevMode()) {
    addRxPlugin(RxDBDevModePlugin);
}

// 2. Add offline-first essentials
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBUpdatePlugin);

export type CinescopeCollections = {
    // movies: RxCollection<MovieDocType>; 
};

export type CinescopeDatabase = RxDatabase<CinescopeCollections>;

@Injectable({
    providedIn: 'root'
})
export class DatabaseService {
    private dbInstance: CinescopeDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    constructor() { }

    /**
     * Initializes the RxDB instance.
     * Guaranteed to run only once during the APP_INITIALIZER boot sequence.
     */
    public async initDatabase(): Promise<void> {
        // Prevent duplicate calls if Angular tries to boot twice in dev mode
        if (this.dbInstance) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const baseStorage = getRxStorageDexie();
                const storageWrapper = isDevMode()
                    ? wrappedValidateAjvStorage({ storage: baseStorage })
                    : baseStorage;

                this.dbInstance = await createRxDatabase<CinescopeCollections>({
                    name: 'cinescopedb',
                    storage: storageWrapper,
                    multiInstance: true,
                });

                console.log('🎬 CINESCOPE Database Initialized Successfully');
            } catch (error) {
                console.error('CRITICAL: Failed to initialize RxDB instance', error);
                throw error;
            }
        })();

        return this.initPromise;
    }

    /**
     * Synchronously returns the database instance.
     * Safe to call in any component constructor because APP_INITIALIZER 
     * guarantees this is populated before the app renders.
     */
    public get db(): CinescopeDatabase {
        if (!this.dbInstance) {
            throw new Error('Database accessed before initialization completed. Check APP_INITIALIZER.');
        }
        return this.dbInstance;
    }
}