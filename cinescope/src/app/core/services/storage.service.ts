import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { ContentDocType } from '../database/schemas/content.schema';
import { SettingsDocType } from '../database/schemas/settings.schema';
import { SearchHistoryDocType } from '../database/schemas/search-history.schema';
import { BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { resolveMediaImageUrl } from '../constants/api.constants';
import { PosterCacheService } from './poster-cache.service';

// Enterprise strict type for generic JSON objects (replaces 'any')
export type TmdbPayload = Record<string, unknown>;

export interface CinescopeBackupPayload {
    version: number;
    exportedAt: string;
    settings: SettingsDocType | null;
    content: ContentDocType[];
    searchHistory: SearchHistoryDocType[];
}

export interface LegacyGenreItem {
    id: number;
    name: string;
}

export interface LegacyContentItem {
    contentId?: number;
    id?: number;
    title?: string;
    name?: string;
    poster_path?: string | null;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
    genres?: LegacyGenreItem[];
    isMovie?: boolean;
    isTv?: boolean;
    isWatchlist?: boolean;
    isWatched?: boolean;
    watchedAt?: string;
    addedAt?: string;
    media_type?: 'movie' | 'tv';
}

export interface LegacyBackupPayload {
    version?: number;
    createdAt?: string;
    app?: string;
    data?: {
        watchlist_contents?: LegacyContentItem[];
        watched_contents?: LegacyContentItem[];
        settings?: {
            allowAdultContent?: boolean;
            theme?: string;
        };
    };
}

export interface BackupImportResult {
    contentCount: number;
    watchlistCount: number;
    watchedCount: number;
    historyCount: number;
}

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private dbService = inject(DatabaseService);
    private posterCache = inject(PosterCacheService);
    private streamsInitialized = false;

    // ==========================================
    // ⚡ REACTIVE SIGNALS (Global App State Bridge)
    // ==========================================
    public readonly watchlistItems = signal<ContentDocType[]>([]);
    public readonly watchedItems = signal<ContentDocType[]>([]);
    public readonly favoritePeople = signal<ContentDocType[]>([]);
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

    /**
     * Reactive O(1) set of watched media keys (`movie_550`, `tv_1399`) for fast progress calculation.
     */
    public readonly watchedMediaKeys = computed<Set<string>>(() => {
        const keys = new Set<string>();
        for (const item of this.watchedItems()) {
            keys.add(item.id);
        }
        return keys;
    });

    constructor() {
        this.initReactiveStreams();
    }

    public initReactiveStreams(): void {
        if (this.streamsInitialized) return;
        try {
            const db = this.dbService.db;
            this.streamsInitialized = true;

            // Single-pass indexed RxDB stream (uses the `addedAt` index instead of two unindexed `$in` scans)
            db.content.find({
                sort: [{ addedAt: 'desc' }]
            }).$.subscribe((docs) => {
                const watchlist: ContentDocType[] = [];
                const watched: ContentDocType[] = [];
                const favoritePeople: ContentDocType[] = [];

                for (const d of docs) {
                    const docJson = d.toJSON() as ContentDocType;
                    if (docJson.mediaType === 'person' && docJson.lists.includes('favorite')) {
                        favoritePeople.push(docJson);
                    } else if (docJson.lists.includes('watched')) {
                        watched.push(docJson);
                    } else if (docJson.lists.includes('watchlist')) {
                        watchlist.push(docJson);
                    }
                }

                this.watchlistItems.set(watchlist);
                this.watchedItems.set(watched);
                this.favoritePeople.set(favoritePeople);

                // Pre-decode top 30 Watchlist + top 30 Watched posters into GPU/RAM bitmaps
                const topDocs = [...watchlist.slice(0, 30), ...watched.slice(0, 30)];
                const priorityPosterUrls: string[] = [];
                for (const doc of topDocs) {
                    const payload = doc.payload as Record<string, unknown> | undefined;
                    const rawPath = (payload?.['poster_path'] || payload?.['profile_path'] || payload?.['posterUrl']) as string | undefined;
                    if (rawPath) {
                        priorityPosterUrls.push(resolveMediaImageUrl(rawPath, 'w342'));
                    }
                }
                setTimeout(() => {
                    this.posterCache.prewarmUrls(priorityPosterUrls);
                }, 400);
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

    public getCachedDoc(tmdbId: number | string, mediaType: 'movie' | 'tv' | 'person' = 'movie'): ContentDocType | null {
        this.initReactiveStreams();
        const docId = this.generateId(Number(tmdbId), mediaType);
        return (
            this.watchlistItems().find((d) => d.id === docId) ??
            this.watchedItems().find((d) => d.id === docId) ??
            null
        );
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
    // 🌟 FAVORITE PEOPLE & PROGRESS TRACKING
    // ==========================================

    public isPersonFavorite(personId: number): boolean {
        this.initReactiveStreams();
        const docId = this.generateId(personId, 'person');
        return this.favoritePeople().some((p) => p.id === docId);
    }

    public async toggleFavoritePerson(person: {
        id: number;
        name: string;
        profilePath?: string | null;
        department?: string;
        creditIds?: string[];
    }): Promise<boolean> {
        this.initReactiveStreams();
        const isFav = this.isPersonFavorite(person.id);

        if (isFav) {
            await this.removeFavoritePerson(person.id);
            return false;
        } else {
            const docId = this.generateId(person.id, 'person');
            const now = new Date().toISOString();
            await this.dbService.db.content.upsert({
                id: docId,
                tmdbId: person.id,
                mediaType: 'person',
                lists: ['favorite'],
                addedAt: now,
                payload: {
                    id: person.id,
                    name: person.name,
                    profile_path: person.profilePath ?? null,
                    known_for_department: person.department ?? 'Artist',
                    credit_ids: person.creditIds ?? []
                }
            });
            return true;
        }
    }

    public async removeFavoritePerson(personId: number): Promise<void> {
        await this.removeMedia(personId, 'person');
    }

    public async updateFavoritePersonCredits(personId: number, creditIds: string[]): Promise<void> {
        this.initReactiveStreams();
        const docId = this.generateId(personId, 'person');
        const doc = await this.dbService.db.content.findOne(docId).exec();
        if (doc) {
            await doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                const payload = (docData.payload ?? {}) as Record<string, unknown>;
                payload['credit_ids'] = creditIds;
                docData.payload = payload;
                return docData;
            });
        }
    }

    public getPersonProgress(creditIds?: string[]): { watched: number; total: number; percent: number } {
        if (!creditIds || creditIds.length === 0) {
            return { watched: 0, total: 0, percent: 0 };
        }
        const watchedKeys = this.watchedMediaKeys();
        let watched = 0;
        for (const cid of creditIds) {
            if (watchedKeys.has(cid)) {
                watched++;
            }
        }
        const total = creditIds.length;
        const percent = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
        return { watched, total, percent };
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

    public async importBackupJson(rawJson: string): Promise<BackupImportResult> {
        this.initReactiveStreams();
        const parsed = JSON.parse(rawJson) as Partial<CinescopeBackupPayload> & LegacyBackupPayload;

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid backup file format.');
        }

        let watchlistCount = 0;
        let watchedCount = 0;
        let historyCount = 0;

        // 1. Restore Settings (supports both v4 `parsed.settings` and Legacy v1 `parsed.data.settings`)
        const rawSettings = parsed.settings ?? parsed.data?.settings;
        if (rawSettings && typeof rawSettings === 'object') {
            const rawTheme = rawSettings.theme;
            const validTheme: 'system' | 'light' | 'dark' =
                rawTheme === 'light' || rawTheme === 'dark' || rawTheme === 'system' ? rawTheme : 'dark';

            await this.dbService.db.settings.upsert({
                id: 'user_preferences',
                allowAdultContent: Boolean(rawSettings.allowAdultContent),
                theme: validTheme
            });
        }

        const docsById = new Map<string, ContentDocType>();

        // 2. Restore Legacy v1 Format (`data.watchlist_contents` & `data.watched_contents`)
        const legacyData = parsed.data;
        if (legacyData && typeof legacyData === 'object') {
            const parsedCreatedAt = parsed.createdAt ? Date.parse(parsed.createdAt) : NaN;
            const baseTimestamp = Number.isFinite(parsedCreatedAt) ? parsedCreatedAt : Date.now();

            if (Array.isArray(legacyData.watchlist_contents)) {
                legacyData.watchlist_contents.forEach((item, index) => {
                    const doc = this.mapLegacyItemToDoc(item, 'watchlist', baseTimestamp, index);
                    if (doc) {
                        docsById.set(doc.id, doc);
                    }
                });
            }

            if (Array.isArray(legacyData.watched_contents)) {
                legacyData.watched_contents.forEach((item, index) => {
                    const doc = this.mapLegacyItemToDoc(item, 'watched', baseTimestamp, index);
                    if (doc) {
                        docsById.set(doc.id, doc);
                    }
                });
            }
        }

        // 3. Restore Modern v4 Format (`parsed.content`)
        if (Array.isArray(parsed.content)) {
            for (const item of parsed.content) {
                if (item && item.id && item.tmdbId && item.mediaType && Array.isArray(item.lists)) {
                    docsById.set(item.id, item);
                }
            }
        }

        const docsToUpsert = Array.from(docsById.values());
        if (docsToUpsert.length > 0) {
            await this.dbService.db.content.bulkUpsert(docsToUpsert);
            for (const doc of docsToUpsert) {
                if (doc.lists.includes('watched')) {
                    watchedCount++;
                } else if (doc.lists.includes('watchlist')) {
                    watchlistCount++;
                }
            }
        }

        // 4. Restore Search History (if present)
        if (Array.isArray(parsed.searchHistory)) {
            const validHistory = parsed.searchHistory.filter(
                (entry): entry is SearchHistoryDocType =>
                    Boolean(entry && entry.query && typeof entry.timestamp === 'number')
            );
            if (validHistory.length > 0) {
                await this.dbService.db.searchHistory.bulkUpsert(validHistory);
                historyCount = validHistory.length;
            }
        }

        return {
            contentCount: docsToUpsert.length,
            watchlistCount,
            watchedCount,
            historyCount
        };
    }

    // ==========================================
    // ⚙️ UTILITIES
    // ==========================================

    private mapLegacyItemToDoc(
        item: LegacyContentItem,
        targetList: 'watchlist' | 'watched',
        baseTimestamp: number,
        index: number
    ): ContentDocType | null {
        if (!item || typeof item !== 'object') return null;

        const tmdbId = Number(item.contentId ?? item.id);
        if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;

        const mediaType: 'movie' | 'tv' =
            item.isTv === true || item.media_type === 'tv' || (!item.isMovie && Boolean(item.name && !item.title))
                ? 'tv'
                : 'movie';

        const docId = this.generateId(tmdbId, mediaType);
        const staggeredIso = new Date(baseTimestamp - index * 1000).toISOString();
        const watchedAt = targetList === 'watched' ? (item.watchedAt || staggeredIso) : undefined;
        const addedAt = item.addedAt || watchedAt || staggeredIso;

        const cleanTitle = this.repairMojibake(item.title);
        const cleanName = this.repairMojibake(item.name);
        const displayTitle = cleanTitle || cleanName || `#${tmdbId}`;
        const posterPath = item.poster_path ?? null;

        const payload: TmdbPayload = {
            ...item,
            id: tmdbId,
            contentId: tmdbId,
            media_type: mediaType,
            title: cleanTitle || displayTitle,
            name: cleanName || displayTitle,
            poster_path: posterPath,
            posterUrl: resolveMediaImageUrl(posterPath, 'w500'),
            vote_average: typeof item.vote_average === 'number' ? item.vote_average : 0,
            release_date: item.release_date ?? item.first_air_date ?? '',
            first_air_date: item.first_air_date ?? item.release_date ?? '',
            genres: Array.isArray(item.genres) ? item.genres : []
        };

        const doc: ContentDocType = {
            id: docId,
            tmdbId,
            mediaType,
            lists: [targetList],
            addedAt,
            payload
        };

        if (watchedAt) {
            doc.watchedAt = watchedAt;
        }

        return doc;
    }

    /**
     * Repairs double-encoded UTF-8 / Latin-1 mojibake strings occasionally found in legacy backups
     * (e.g. "Naruto ShippÃ\u0085Â«den" -> "Naruto Shippūden").
     */
    private repairMojibake(value: unknown): string | undefined {
        if (typeof value !== 'string' || !value) return undefined;
        let current = value;
        for (let pass = 0; pass < 2; pass++) {
            if (!/[ÃÂÅ][\u0080-\u00BF]/.test(current)) break;
            try {
                const bytes = new Uint8Array(Array.from(current, (ch) => ch.charCodeAt(0) & 0xff));
                current = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch {
                break;
            }
        }
        return current;
    }

    private generateId(tmdbId: number, mediaType: 'movie' | 'tv' | 'person'): string {
        return `${mediaType}_${tmdbId}`;
    }
}