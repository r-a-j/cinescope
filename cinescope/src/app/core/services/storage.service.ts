import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { ContentDocType } from '../database/schemas/content.schema';
import { SettingsDocType } from '../database/schemas/settings.schema';
import { SearchHistoryDocType } from '../database/schemas/search-history.schema';
import { BookmarkState } from '../../shared/components/poster-card/poster-card.component';

// Enterprise strict type for generic JSON objects (replaces 'any')
export type TmdbPayload = Record<string, unknown>;

export interface CinescopeBackupPayload {
    version: number;
    exportedAt: string;
    settings: SettingsDocType | null;
    content: ContentDocType[];
    searchHistory: SearchHistoryDocType[];
}

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private dbService = inject(DatabaseService);
    private streamsInitialized = false;

    // ==========================================
    // ⚡ REACTIVE SIGNALS (Global App State Bridge)
    // ==========================================
    public readonly watchlistItems = signal<ContentDocType[]>([]);
    public readonly watchedItems = signal<ContentDocType[]>([]);
    public readonly settings = signal<SettingsDocType | null>(null);

    public readonly allowAdultContent = computed<boolean>(() => {
        return this.settings()?.allowAdultContent ?? false;
    });

    /**
     * Reactive O(1) map of document IDs (`movie_550`, `tv_1399`) to BookmarkState.
     */
    public readonly bookmarkStateMap = computed<Record<string, BookmarkState>>(() => {
        const map: Record<string, BookmarkState> = {};
        for (const item of this.watchlistItems()) {
            map[item.id] = 'watchlist';
        }
        for (const item of this.watchedItems()) {
            map[item.id] = 'watched';
        }
        return map;
    });

    constructor() {
        this.initReactiveStreams();
    }

    public initReactiveStreams(): void {
        if (this.streamsInitialized) return;
        try {
            const db = this.dbService.db;
            this.streamsInitialized = true;

            db.content.find({
                selector: { lists: { $in: ['watchlist'] } },
                sort: [{ addedAt: 'desc' }]
            }).$.subscribe((docs) => {
                this.watchlistItems.set(docs.map((d) => d.toJSON() as ContentDocType));
            });

            db.content.find({
                selector: { lists: { $in: ['watched'] } },
                sort: [{ addedAt: 'desc' }]
            }).$.subscribe((docs) => {
                this.watchedItems.set(docs.map((d) => d.toJSON() as ContentDocType));
            });

            db.settings.findOne('user_preferences').$.subscribe((doc) => {
                this.settings.set(doc ? (doc.toJSON() as SettingsDocType) : null);
            });
        } catch {
            // If instantiated before APP_INITIALIZER finishes, it will be initialized on first access
        }
    }

    public getBookmarkState(tmdbId: number | string, mediaType: 'movie' | 'tv' | 'person' = 'movie'): BookmarkState {
        this.initReactiveStreams();
        const docId = this.generateId(Number(tmdbId), mediaType);
        return this.bookmarkStateMap()[docId] ?? 'none';
    }

    // ==========================================
    // 📡 REACTIVE STREAMS (For the UI)
    // ==========================================

    public getWatchlist$(): Observable<ContentDocType[]> {
        this.initReactiveStreams();
        return this.dbService.db.content.find({
            selector: { lists: { $in: ['watchlist'] } },
            sort: [{ addedAt: 'desc' }]
        }).$;
    }

    public getWatched$(): Observable<ContentDocType[]> {
        this.initReactiveStreams();
        return this.dbService.db.content.find({
            selector: { lists: { $in: ['watched'] } },
            sort: [{ addedAt: 'desc' }]
        }).$;
    }

    public async getSettings(): Promise<SettingsDocType | null> {
        this.initReactiveStreams();
        const cached = this.settings();
        if (cached) return cached;
        const doc = await this.dbService.db.settings.findOne('user_preferences').exec();
        return doc ? (doc.toJSON() as SettingsDocType) : null;
    }

    // ==========================================
    // 💾 IMPERATIVE READS (For initial loads)
    // ==========================================

    public async getWatchlist(): Promise<ContentDocType[]> {
        this.initReactiveStreams();
        const docs = await this.dbService.db.content.find({
            selector: { lists: { $in: ['watchlist'] } },
            sort: [{ addedAt: 'desc' }]
        }).exec();
        return docs.map((d) => d.toJSON() as ContentDocType);
    }

    public async getWatched(): Promise<ContentDocType[]> {
        this.initReactiveStreams();
        const docs = await this.dbService.db.content.find({
            selector: { lists: { $in: ['watched'] } },
            sort: [{ addedAt: 'desc' }]
        }).exec();
        return docs.map((d) => d.toJSON() as ContentDocType);
    }

    // ==========================================
    // ✍️ MUTATIONS (Write, Update, Delete)
    // ==========================================

    public async updateSettings(updates: Partial<SettingsDocType>): Promise<void> {
        this.initReactiveStreams();
        const doc = await this.dbService.db.settings.findOne('user_preferences').exec();
        if (doc) {
            // incrementalPatch safely updates only the provided fields without overwriting the rest
            await doc.incrementalPatch(updates);
        }
    }

    /**
     * Cycles an item's bookmark state: 'none' -> 'watchlist' -> 'watched' -> 'none'.
     */
    public async cycleBookmark(
        tmdbId: number,
        mediaType: 'movie' | 'tv',
        payload: TmdbPayload
    ): Promise<BookmarkState> {
        this.initReactiveStreams();
        const current = this.getBookmarkState(tmdbId, mediaType);

        if (current === 'none') {
            await this.addToWatchlist(tmdbId, mediaType, payload);
            return 'watchlist';
        } else if (current === 'watchlist') {
            await this.moveToWatched(tmdbId, mediaType);
            return 'watched';
        } else {
            await this.removeMedia(tmdbId, mediaType);
            return 'none';
        }
    }

    public async addToWatchlist(tmdbId: number, mediaType: 'movie' | 'tv' | 'person', payload: TmdbPayload): Promise<void> {
        this.initReactiveStreams();
        const docId: string = this.generateId(tmdbId, mediaType);

        await this.dbService.db.content.upsert({
            id: docId,
            tmdbId: tmdbId,
            mediaType: mediaType,
            lists: ['watchlist'],
            addedAt: new Date().toISOString(),
            payload: payload
        });
    }

    public async moveToWatched(tmdbId: number, mediaType: 'movie' | 'tv', payload?: TmdbPayload): Promise<void> {
        this.initReactiveStreams();
        const docId: string = this.generateId(tmdbId, mediaType);
        const doc = await this.dbService.db.content.findOne(docId).exec();

        if (doc) {
            await doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                docData.lists = ['watched']; // Overwrite lists to only be 'watched'
                docData.watchedAt = new Date().toISOString();
                return docData;
            });
        } else if (payload) {
            const now = new Date().toISOString();
            await this.dbService.db.content.upsert({
                id: docId,
                tmdbId,
                mediaType,
                lists: ['watched'],
                addedAt: now,
                watchedAt: now,
                payload
            });
        }
    }

    public async removeMedia(tmdbId: number, mediaType: 'movie' | 'tv' | 'person'): Promise<void> {
        this.initReactiveStreams();
        const docId: string = this.generateId(tmdbId, mediaType);
        const doc = await this.dbService.db.content.findOne(docId).exec();

        if (doc) {
            await doc.remove();
        }
    }

    // ==========================================
    // 🚀 BULK & DATA MANAGEMENT OPERATIONS
    // ==========================================

    public async bulkMoveToWatched(tmdbIds: number[], mediaType: 'movie' | 'tv'): Promise<void> {
        this.initReactiveStreams();
        const docIds: string[] = tmdbIds.map((id: number): string => this.generateId(id, mediaType));

        const docs = await this.dbService.db.content.find({
            selector: { id: { $in: docIds } }
        }).exec();

        const promises: Promise<unknown>[] = docs.map((doc) =>
            doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                docData.lists = ['watched'];
                docData.watchedAt = new Date().toISOString();
                return docData;
            })
        );

        await Promise.all(promises);
    }

    public async bulkRemoveMedia(tmdbIds: number[], mediaType: 'movie' | 'tv'): Promise<void> {
        this.initReactiveStreams();
        const docIds: string[] = tmdbIds.map((id: number): string => this.generateId(id, mediaType));

        const docs = await this.dbService.db.content.find({
            selector: { id: { $in: docIds } }
        }).exec();

        const promises: Promise<unknown>[] = docs.map((doc) => doc.remove());
        await Promise.all(promises);
    }

    public async clearWatchlist(): Promise<number> {
        this.initReactiveStreams();
        const docs = await this.dbService.db.content.find({
            selector: { lists: { $in: ['watchlist'] } }
        }).exec();
        await Promise.all(docs.map((doc) => doc.remove()));
        return docs.length;
    }

    public async clearWatchedList(): Promise<number> {
        this.initReactiveStreams();
        const docs = await this.dbService.db.content.find({
            selector: { lists: { $in: ['watched'] } }
        }).exec();
        await Promise.all(docs.map((doc) => doc.remove()));
        return docs.length;
    }

    public async exportBackupJson(): Promise<string> {
        this.initReactiveStreams();
        const [settingsDoc, contentDocs, historyDocs] = await Promise.all([
            this.dbService.db.settings.findOne('user_preferences').exec(),
            this.dbService.db.content.find().exec(),
            this.dbService.db.searchHistory.find().exec()
        ]);

        const payload: CinescopeBackupPayload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            settings: settingsDoc ? (settingsDoc.toJSON() as SettingsDocType) : null,
            content: contentDocs.map((d) => d.toJSON() as ContentDocType),
            searchHistory: historyDocs.map((d) => d.toJSON() as SearchHistoryDocType)
        };

        return JSON.stringify(payload, null, 2);
    }

    public async importBackupJson(rawJson: string): Promise<{ contentCount: number; historyCount: number }> {
        this.initReactiveStreams();
        const parsed = JSON.parse(rawJson) as Partial<CinescopeBackupPayload>;

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid backup file format.');
        }

        let contentCount = 0;
        let historyCount = 0;

        if (parsed.settings && parsed.settings.id === 'user_preferences') {
            await this.dbService.db.settings.upsert({
                id: 'user_preferences',
                allowAdultContent: Boolean(parsed.settings.allowAdultContent),
                theme: parsed.settings.theme || 'system'
            });
        }

        if (Array.isArray(parsed.content)) {
            for (const item of parsed.content) {
                if (item && item.id && item.tmdbId && item.mediaType && Array.isArray(item.lists)) {
                    await this.dbService.db.content.upsert(item);
                    contentCount++;
                }
            }
        }

        if (Array.isArray(parsed.searchHistory)) {
            for (const entry of parsed.searchHistory) {
                if (entry && entry.query && typeof entry.timestamp === 'number') {
                    await this.dbService.db.searchHistory.upsert(entry);
                    historyCount++;
                }
            }
        }

        return { contentCount, historyCount };
    }

    // ==========================================
    // ⚙️ UTILITIES
    // ==========================================

    private generateId(tmdbId: number, mediaType: 'movie' | 'tv' | 'person'): string {
        return `${mediaType}_${tmdbId}`;
    }
}