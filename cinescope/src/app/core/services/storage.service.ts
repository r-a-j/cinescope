import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { ContentDocType } from '../database/schemas/content.schema';
import { SettingsDocType } from '../database/schemas/settings.schema';
import { RegionService } from './region.service';
import { SearchHistoryDocType } from '../database/schemas/search-history.schema';
import { TvProgressDocType } from '../database/schemas/tv-progress.schema';
import { BookmarkState } from '../../shared/components/poster-card/poster-card.component';
import { resolveMediaImageUrl } from '../constants/api.constants';
import { PosterCacheService } from './poster-cache.service';
import { FranchiseCollectionSummary } from '../models/franchise.model';

// Enterprise strict type for generic JSON objects (replaces 'any')
export type TmdbPayload = Record<string, unknown>;

export interface MediaReleaseCheckResult {
    isReleased: boolean;
    releaseLabel: string;
}

/**
 * Returns local calendar date in `YYYY-MM-DD` format (avoiding UTC day-shift bugs).
 */
export function getLocalTodayIso(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Smart release-status checker that handles:
 * - Full dates (`YYYY-MM-DD`), including tomorrow vs today within the same year
 * - Year + Month (`YYYY-MM`)
 * - Year-only (`2027` via `release_date`, `first_air_date`, `year`, or `releaseYear`)
 * - Missing dates / TBA (`release_date: ""` or `status: "In Production" / "Planned" / "Rumored"`)
 */
export function checkMediaReleaseStatus(
    payload?: Record<string, unknown> | null,
    referenceDateIso?: string
): MediaReleaseCheckResult {
    if (!payload) {
        return { isReleased: true, releaseLabel: '' };
    }

    const todayIso = referenceDateIso || getLocalTodayIso();
    const currentYear = parseInt(todayIso.slice(0, 4), 10);
    const currentYearMonth = todayIso.slice(0, 7);

    const rawStatus = String(payload['status'] || '').trim();
    const isUnreleasedStatus = /^(rumored|planned|in production|post production|upcoming|pilot)$/i.test(rawStatus);

    const rawDate = String(
        payload['release_date'] ??
        payload['first_air_date'] ??
        payload['releaseDate'] ??
        payload['firstAirDate'] ??
        ''
    ).trim();

    // 1. Full YYYY-MM-DD date (e.g. "2026-10-25" releasing tomorrow vs "2026-10-24" today)
    const fullDateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (fullDateMatch && fullDateMatch[1]) {
        const datePart = fullDateMatch[1];
        if (datePart > todayIso) {
            return { isReleased: false, releaseLabel: datePart };
        }
        return { isReleased: true, releaseLabel: datePart };
    }

    // 2. Partial YYYY-MM date (e.g. "2026-12")
    const ymMatch = rawDate.match(/^(\d{4}-\d{2})$/);
    if (ymMatch && ymMatch[1]) {
        const ymPart = ymMatch[1];
        if (ymPart > currentYearMonth) {
            return { isReleased: false, releaseLabel: ymPart };
        }
        return { isReleased: true, releaseLabel: ymPart };
    }

    // 3. Year-only (e.g. "2027" in rawDate or in year / releaseYear fields)
    const rawYearField = payload['year'] ?? payload['releaseYear'] ?? payload['release_year'];
    const yearCandidate = rawDate.match(/^(\d{4})$/)?.[1]
        || (rawYearField !== undefined && rawYearField !== null ? String(rawYearField).trim() : '');
    const yearMatch = yearCandidate.match(/^(\d{4})/);
    if (yearMatch && yearMatch[1]) {
        const yearNum = parseInt(yearMatch[1], 10);
        if (yearNum > currentYear) {
            return { isReleased: false, releaseLabel: String(yearNum) };
        }
        if (yearNum === currentYear && isUnreleasedStatus) {
            return { isReleased: false, releaseLabel: `${rawStatus} (${yearNum})` };
        }
        return { isReleased: true, releaseLabel: String(yearNum) };
    }

    // 4. No date or year present at all
    if (isUnreleasedStatus) {
        return { isReleased: false, releaseLabel: rawStatus || 'TBA' };
    }

    if ('release_date' in payload || 'first_air_date' in payload || payload['isUpcoming'] === true) {
        return { isReleased: false, releaseLabel: 'TBA' };
    }

    return { isReleased: true, releaseLabel: '' };
}

export interface CinescopeBackupPayload {
    version: number;
    appVersion?: string | undefined;
    app?: string | undefined;
    exportedAt: string;
    settings: SettingsDocType | null;
    content: ContentDocType[];
    searchHistory: SearchHistoryDocType[];
    tvProgress?: TvProgressDocType[] | undefined;
}

export interface BackupInspectionResult {
    isValid: boolean;
    format: 'modern' | 'legacy' | 'unknown';
    version: number;
    appVersion?: string | undefined;
    exportedAt?: string | undefined;
    totalTitles: number;
    watchlistCount: number;
    watchedCount: number;
    inboxCount: number;
    favoritePeopleCount: number;
    historyCount: number;
    hasSettings: boolean;
    tvProgressCount?: number | undefined;
    error?: string | undefined;
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
    appVersion?: string;
    createdAt?: string;
    app?: string;
    data?: {
        watchlist_contents?: LegacyContentItem[];
        watched_contents?: LegacyContentItem[];
        settings?: {
            allowAdultContent?: boolean;
            theme?: string;
            appTourCompleted?: boolean;
        };
    };
}

export interface BackupImportResult {
    contentCount: number;
    watchlistCount: number;
    watchedCount: number;
    inboxCount: number;
    favoritePeopleCount: number;
    historyCount: number;
    tvProgressCount?: number | undefined;
}

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private dbService = inject(DatabaseService);
    private posterCache = inject(PosterCacheService);
    private regionService = inject(RegionService);
    private streamsInitialized = false;
    private autoDetectTriggered = false;

    // ==========================================
    // ⚡ REACTIVE SIGNALS (Global App State Bridge)
    // ==========================================
    public readonly watchlistItems = signal<ContentDocType[]>([]);
    public readonly watchedItems = signal<ContentDocType[]>([]);
    public readonly inboxItems = signal<ContentDocType[]>([]);
    public readonly favoritePeople = signal<ContentDocType[]>([]);
    public readonly savedUniverses = signal<ContentDocType[]>([]);
    public readonly settings = signal<SettingsDocType | null>(null);
    public readonly userRegion = computed<string>(() => this.settings()?.region || 'IN');
    public readonly isManualRegion = computed<boolean>(() => this.settings()?.isManualRegion ?? false);

    public readonly inboxCount = computed<number>(() => this.inboxItems().length);

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
        if (!this.dbService.isInitialized()) {
            this.dbService.getDatabase().then(() => {
                if (!this.streamsInitialized) {
                    this.initReactiveStreams();
                }
            }).catch(err => {
                console.error('Failed to initialize reactive streams from RxDB:', err);
            });
            return;
        }
        try {
            const db = this.dbService.db;
            if (!db?.content || !db?.settings) {
                return;
            }

            // Single-pass indexed RxDB stream (uses the `addedAt` index instead of two unindexed `$in` scans)
            db.content.find({
                sort: [{ addedAt: 'desc' }]
            }).$.subscribe({
                next: (docs) => {
                    const watchlist: ContentDocType[] = [];
                    const watched: ContentDocType[] = [];
                    const inbox: ContentDocType[] = [];
                    const favoritePeople: ContentDocType[] = [];
                    const savedUniverses: ContentDocType[] = [];

                    for (const d of docs) {
                        const docJson = d.toJSON() as ContentDocType;
                        if (docJson.mediaType === 'person' && docJson.lists.includes('favorite')) {
                            favoritePeople.push(docJson);
                        } else if (docJson.lists.includes('universe') || docJson.lists.includes('franchise')) {
                            savedUniverses.push(docJson);
                        } else if (docJson.lists.includes('inbox')) {
                            inbox.push(docJson);
                        } else if (docJson.lists.includes('watched')) {
                            watched.push(docJson);
                        } else if (docJson.lists.includes('watchlist')) {
                            watchlist.push(docJson);
                        }
                    }

                    this.watchlistItems.set(watchlist);
                    this.watchedItems.set(watched);
                    this.inboxItems.set(inbox);
                    this.favoritePeople.set(favoritePeople);
                    this.savedUniverses.set(savedUniverses);

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
                },
                error: (err) => {
                    console.error('[StorageService] Content stream error:', err);
                }
            });

            db.settings.findOne('user_preferences').$.subscribe({
                next: (doc) => {
                    const settingsDoc = doc ? (doc.toJSON() as SettingsDocType) : null;
                    this.settings.set(settingsDoc);
                    if (settingsDoc && !settingsDoc.isManualRegion && !this.autoDetectTriggered) {
                        this.autoDetectTriggered = true;
                        void this.autoDetectAndApplyRegion();
                    }
                },
                error: (err) => {
                    console.error('[StorageService] Settings stream error:', err);
                }
            });

            this.streamsInitialized = true;
        } catch {
            this.streamsInitialized = false;
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

    public getInbox$(): Observable<ContentDocType[]> {
        this.initReactiveStreams();
        return this.dbService.db.content.find({
            selector: { lists: { $in: ['inbox'] } },
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

    public async getInbox(): Promise<ContentDocType[]> {
        this.initReactiveStreams();
        const docs = await this.dbService.db.content.find({
            selector: { lists: { $in: ['inbox'] } },
            sort: [{ addedAt: 'desc' }]
        }).exec();
        return docs.map((d) => d.toJSON() as ContentDocType);
    }

    // ==========================================
    // ✍️ MUTATIONS (Write, Update, Delete)
    // ==========================================

    public async autoDetectAndApplyRegion(): Promise<string> {
        try {
            const result = await this.regionService.detectRegion();
            await this.updateSettings({
                region: result.resolvedRegion,
                isManualRegion: false
            });
            return result.resolvedRegion;
        } catch (err) {
            console.warn('[StorageService] Failed to auto-detect region:', err);
            return 'IN';
        }
    }

    public async updateSettings(updates: Partial<SettingsDocType>): Promise<void> {
        this.initReactiveStreams();
        const doc = await this.dbService.db.settings.findOne('user_preferences').exec();
        if (doc) {
            // incrementalPatch safely updates only the provided fields without overwriting the rest
            await doc.incrementalPatch(updates);
        }
    }

    /**
     * Verifies whether a media payload has already been released.
     */
    public checkReleaseStatus(payload?: TmdbPayload | null): MediaReleaseCheckResult {
        return checkMediaReleaseStatus(payload);
    }

    /**
     * Cycles an item's bookmark state:
     * - For released titles: 'none' -> 'watchlist' -> 'watched' -> 'none'
     * - For unreleased/future titles: 'none' -> 'watchlist' -> 'none' (cannot mark future titles as Watched)
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
            const moved = await this.moveToWatched(tmdbId, mediaType, payload);
            if (moved) {
                return 'watched';
            }
            // Title is unreleased (future date/year or TBA) — skip 'watched' and remove from Watchlist
            await this.removeMedia(tmdbId, mediaType);
            return 'none';
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

    /**
     * Moves a title to the 'watched' list only if its release date/year is in the past or today.
     * Returns `false` if the title has not been released yet.
     */
    public async moveToWatched(tmdbId: number, mediaType: 'movie' | 'tv', payload?: TmdbPayload): Promise<boolean> {
        this.initReactiveStreams();
        const docId: string = this.generateId(tmdbId, mediaType);
        const doc = await this.dbService.db.content.findOne(docId).exec();
        const existingPayload = (doc?.toJSON() as ContentDocType | undefined)?.payload as TmdbPayload | undefined;
        const effectivePayload = payload ? { ...(existingPayload || {}), ...payload } : existingPayload;

        const releaseCheck = checkMediaReleaseStatus(effectivePayload);
        if (!releaseCheck.isReleased) {
            return false;
        }

        if (doc) {
            await doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                docData.lists = ['watched']; // Overwrite lists to only be 'watched'
                docData.watchedAt = new Date().toISOString();
                if (effectivePayload) {
                    docData.payload = effectivePayload;
                }
                return docData;
            });
            return true;
        } else if (effectivePayload) {
            const now = new Date().toISOString();
            await this.dbService.db.content.upsert({
                id: docId,
                tmdbId,
                mediaType,
                lists: ['watched'],
                addedAt: now,
                watchedAt: now,
                payload: effectivePayload
            });
            return true;
        }
        return false;
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
    // 📥 INBOX TRIAGE & EXTRACTION QUEUE
    // ==========================================

    /**
     * Staging an item into the Inbox triage queue.
     * Returns false if the item is already in Watchlist or Watched to prevent unnecessary triage duplicate.
     */
    public async addToInbox(tmdbId: number, mediaType: 'movie' | 'tv', payload: TmdbPayload): Promise<boolean> {
        this.initReactiveStreams();
        const docId: string = this.generateId(tmdbId, mediaType);
        const existing = await this.dbService.db.content.findOne(docId).exec();

        if (existing) {
            const data = existing.toJSON() as ContentDocType;
            if (data.lists.includes('watchlist') || data.lists.includes('watched')) {
                return false;
            }
        }

        await this.dbService.db.content.upsert({
            id: docId,
            tmdbId,
            mediaType,
            lists: ['inbox'],
            addedAt: new Date().toISOString(),
            payload
        });
        return true;
    }

    /**
     * Moves a triaged item from Inbox to Watchlist.
     */
    public async moveInboxToWatchlist(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
        this.initReactiveStreams();
        const docId: string = this.generateId(tmdbId, mediaType);
        const doc = await this.dbService.db.content.findOne(docId).exec();
        if (doc) {
            await doc.incrementalModify((d: ContentDocType): ContentDocType => {
                d.lists = ['watchlist'];
                return d;
            });
        }
    }

    /**
     * Moves a triaged item from Inbox to Watched (or to Watchlist if not yet released).
     */
    public async moveInboxToWatched(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
        this.initReactiveStreams();
        const docId: string = this.generateId(tmdbId, mediaType);
        const doc = await this.dbService.db.content.findOne(docId).exec();
        if (doc) {
            const data = doc.toJSON() as ContentDocType;
            const releaseCheck = checkMediaReleaseStatus(data.payload as TmdbPayload | undefined);
            if (!releaseCheck.isReleased) {
                await doc.incrementalModify((d: ContentDocType): ContentDocType => {
                    d.lists = ['watchlist'];
                    return d;
                });
                return false;
            }
            await doc.incrementalModify((d: ContentDocType): ContentDocType => {
                d.lists = ['watched'];
                d.watchedAt = new Date().toISOString();
                return d;
            });
            return true;
        }
        return false;
    }

    /**
     * Discards an item from the Inbox queue.
     */
    public async discardFromInbox(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
        await this.removeMedia(tmdbId, mediaType);
    }

    // ==========================================
    // UNIVERSE & FRANCHISE ENGINE PERSISTENCE
    // ==========================================

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) || 1;
    }

    /**
     * Persists an AI-ascended universe in RxDB content collection.
     * Normalizes leading `universe_` prefixes to prevent duplicate `universe_universe_*` documents.
     */
    public async saveUniverse(universeId: string | number, payload: FranchiseCollectionSummary): Promise<void> {
        this.initReactiveStreams();
        const cleanKey = String(universeId).replace(/^(universe_)+/, '');
        const canonicalUniverseId = `universe_${cleanKey}`;
        const docId = canonicalUniverseId;
        const numericTmdbId = typeof universeId === 'number'
            ? universeId
            : this.hashString(canonicalUniverseId);

        const normalizedPayload: FranchiseCollectionSummary = {
            ...payload,
            id: canonicalUniverseId,
            universeId: canonicalUniverseId
        };

        await this.dbService.db.content.upsert({
            id: docId,
            tmdbId: numericTmdbId,
            mediaType: 'movie',
            lists: ['universe', 'franchise'],
            addedAt: new Date().toISOString(),
            payload: normalizedPayload as unknown as TmdbPayload
        });

        // Clean up any legacy double-prefixed document (`universe_universe_*`) if present
        const legacyDuplicateId = `universe_universe_${cleanKey}`;
        const legacyDoc = await this.dbService.db.content.findOne(legacyDuplicateId).exec();
        if (legacyDoc) {
            await legacyDoc.remove();
        }
    }

    /**
     * Removes an AI-ascended universe from RxDB without affecting individual user library movies.
     */
    public async removeUniverse(universeId: string | number): Promise<void> {
        this.initReactiveStreams();
        const cleanKey = String(universeId).replace(/^(universe_)+/, '');
        const candidateIds = [`universe_${cleanKey}`, `universe_universe_${cleanKey}`, String(universeId)];
        for (const cid of candidateIds) {
            const doc = await this.dbService.db.content.findOne(cid).exec();
            if (doc) {
                await doc.remove();
            }
        }
        const all = await this.dbService.db.content.find({
            selector: { lists: { $in: ['universe'] } }
        }).exec();
        for (const d of all) {
            const p = d.payload as Record<string, unknown> | undefined;
            const pIdClean = String(p?.['id'] || '').replace(/^(universe_)+/, '');
            const pUniClean = String(p?.['universeId'] || '').replace(/^(universe_)+/, '');
            if (
                pIdClean === cleanKey ||
                pUniClean === cleanKey ||
                String(d.tmdbId) === String(universeId)
            ) {
                await d.remove();
            }
        }
    }

    /**
     * Persists a franchise collection directly in RxDB content collection.
     */
    public async saveFranchise(collectionId: number | string, payload: FranchiseCollectionSummary): Promise<void> {
        this.initReactiveStreams();
        const cleanKey = String(collectionId).replace(/^(franchise_)+/, '');
        const docId = `franchise_${cleanKey}`;
        const numericTmdbId = typeof collectionId === 'number'
            ? collectionId
            : (Number(cleanKey) || this.hashString(cleanKey));

        await this.dbService.db.content.upsert({
            id: docId,
            tmdbId: numericTmdbId,
            mediaType: 'movie',
            lists: ['franchise'],
            addedAt: new Date().toISOString(),
            payload: payload as unknown as TmdbPayload
        });
    }

    /**
     * Removes a franchise collection from RxDB without affecting individual user library movies.
     */
    public async removeFranchise(collectionId: number | string): Promise<void> {
        this.initReactiveStreams();
        const cleanKey = String(collectionId).replace(/^(franchise_)+/, '');
        const docId = `franchise_${cleanKey}`;
        const doc = await this.dbService.db.content.findOne(docId).exec();
        if (doc) {
            await doc.remove();
            return;
        }
        const all = await this.dbService.db.content.find({
            selector: { lists: { $in: ['franchise'] } }
        }).exec();
        for (const d of all) {
            const p = d.payload as Record<string, unknown> | undefined;
            if (
                String(p?.['id']) === cleanKey ||
                String(p?.['id']) === String(collectionId) ||
                String(d.tmdbId) === cleanKey
            ) {
                await d.remove();
            }
        }
    }

    /**
     * Checks if a franchise or universe is saved directly in user library.
     */
    public isFranchiseSaved(collectionId: number | string): boolean {
        const idStr = String(collectionId);
        const cleanKey = idStr.replace(/^(universe_|franchise_)+/, '');
        return this.savedUniverses().some((doc) => {
            const p = doc.payload as Record<string, unknown> | undefined;
            const pIdClean = String(p?.['id'] || '').replace(/^(universe_|franchise_)+/, '');
            const pUniClean = String(p?.['universeId'] || '').replace(/^(universe_|franchise_)+/, '');
            return doc.id === `franchise_${cleanKey}` ||
                   doc.id === `universe_${cleanKey}` ||
                   doc.id === `universe_universe_${cleanKey}` ||
                   String(doc.tmdbId) === idStr ||
                   pIdClean === cleanKey ||
                   pUniClean === cleanKey;
        });
    }

    /**
     * Incrementally patches a media item's payload in RxDB.
     */
    public async updateMediaPayload(docId: string, patch: Record<string, unknown>): Promise<void> {
        this.initReactiveStreams();
        const doc = await this.dbService.db.content.findOne(docId).exec();
        if (doc) {
            await doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                docData.payload = {
                    ...((docData.payload as Record<string, unknown>) || {}),
                    ...patch
                } as unknown as TmdbPayload;
                return docData;
            });
        }
    }

    /**
     * Folds/merges a sub-collection ID into a parent Universe document in RxDB.
     */
    public async mergeCollectionIntoUniverse(universeId: string | number, collectionId: number): Promise<void> {
        this.initReactiveStreams();
        const cleanUniKey = String(universeId).replace(/^(universe_)+/, '');
        const docId = `universe_${cleanUniKey}`;
        const doc = await this.dbService.db.content.findOne(docId).exec();
        if (doc) {
            await doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                const payload = ((docData.payload as Record<string, unknown>) || {});
                const currentMerged = Array.isArray(payload['mergedSubCollectionIds'])
                    ? (payload['mergedSubCollectionIds'] as number[])
                    : [];
                if (!currentMerged.includes(collectionId)) {
                    payload['mergedSubCollectionIds'] = [...currentMerged, collectionId];
                }
                docData.payload = payload as unknown as TmdbPayload;
                return docData;
            });
        }
    }

    /**
     * Unmerges/unfolds a sub-collection ID from a parent Universe document in RxDB so it shows as a standalone card.
     */
    public async unmergeCollectionFromUniverse(universeId: string | number, collectionId: number): Promise<void> {
        this.initReactiveStreams();
        const cleanUniKey = String(universeId).replace(/^(universe_)+/, '');
        const docId = `universe_${cleanUniKey}`;
        const doc = await this.dbService.db.content.findOne(docId).exec();
        if (doc) {
            await doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                const payload = ((docData.payload as Record<string, unknown>) || {});
                const currentMerged = Array.isArray(payload['mergedSubCollectionIds'])
                    ? (payload['mergedSubCollectionIds'] as number[])
                    : [];
                payload['mergedSubCollectionIds'] = currentMerged.filter((id) => id !== collectionId);
                docData.payload = payload as unknown as TmdbPayload;
                return docData;
            });
        }
    }

    /**
     * Checks if a sub-collection is merged into an active Universe.
     */
    public isCollectionMergedIntoUniverse(universeId: string | number, collectionId: number): boolean {
        const cleanUniKey = String(universeId).replace(/^(universe_)+/, '');
        const docId = `universe_${cleanUniKey}`;
        const match = this.savedUniverses().find((d) => d.id === docId || String(d.tmdbId) === cleanUniKey);
        if (!match) return false;
        const payload = match.payload as Record<string, unknown> | undefined;
        const merged = payload?.['mergedSubCollectionIds'] as number[] | undefined;
        return Array.isArray(merged) ? merged.includes(collectionId) : false;
    }

    /**
     * Bulk moves multiple inbox items into Watchlist or Watched.
     * Unreleased items cannot be moved to Watched and are routed to Watchlist instead.
     */
    public async bulkMoveInbox(
        items: { tmdbId: number; mediaType: 'movie' | 'tv' }[],
        targetList: 'watchlist' | 'watched'
    ): Promise<void> {
        this.initReactiveStreams();
        const now = new Date().toISOString();
        for (const item of items) {
            const docId = this.generateId(item.tmdbId, item.mediaType);
            const doc = await this.dbService.db.content.findOne(docId).exec();
            if (doc) {
                const currentData = doc.toJSON() as ContentDocType;
                const isReleased = checkMediaReleaseStatus(currentData.payload as TmdbPayload | undefined).isReleased;
                const effectiveList: 'watchlist' | 'watched' =
                    targetList === 'watched' && !isReleased ? 'watchlist' : targetList;

                await doc.incrementalModify((d: ContentDocType): ContentDocType => {
                    d.lists = [effectiveList];
                    if (effectiveList === 'watched') {
                        d.watchedAt = now;
                    }
                    return d;
                });
            }
        }
    }

    /**
     * Bulk discards multiple inbox items.
     */
    public async bulkDiscardInbox(items: { tmdbId: number; mediaType: 'movie' | 'tv' }[]): Promise<void> {
        this.initReactiveStreams();
        for (const item of items) {
            await this.removeMedia(item.tmdbId, item.mediaType);
        }
    }

    /**
     * Clears all items currently in the Inbox queue.
     */
    public async clearInbox(): Promise<number> {
        this.initReactiveStreams();
        const docs = await this.dbService.db.content.find({
            selector: { lists: { $in: ['inbox'] } }
        }).exec();
        const count = docs.length;
        for (const doc of docs) {
            await doc.remove();
        }
        return count;
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

        const promises: Promise<unknown>[] = docs
            .filter((doc) => {
                const d = doc.toJSON() as ContentDocType;
                return checkMediaReleaseStatus(d.payload as TmdbPayload | undefined).isReleased;
            })
            .map((doc) =>
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

    public inspectBackupJson(rawJson: string): BackupInspectionResult {
        const cleanJson = rawJson.replace(/^\uFEFF/, '').trim();
        let parsed: (Partial<CinescopeBackupPayload> & LegacyBackupPayload) | null = null;

        try {
            parsed = JSON.parse(cleanJson);
        } catch {
            return {
                isValid: false,
                format: 'unknown',
                version: 0,
                totalTitles: 0,
                watchlistCount: 0,
                watchedCount: 0,
                inboxCount: 0,
                favoritePeopleCount: 0,
                historyCount: 0,
                hasSettings: false,
                error: 'The selected file is not a valid JSON document.'
            };
        }

        if (!parsed || typeof parsed !== 'object') {
            return {
                isValid: false,
                format: 'unknown',
                version: 0,
                totalTitles: 0,
                watchlistCount: 0,
                watchedCount: 0,
                inboxCount: 0,
                favoritePeopleCount: 0,
                historyCount: 0,
                hasSettings: false,
                error: 'Backup file root is not an object.'
            };
        }

        // 1. Inspect Modern CineScope Format
        const isModern =
            Array.isArray(parsed.content) ||
            Array.isArray(parsed.tvProgress) ||
            parsed.version === 1 ||
            Boolean(parsed.settings && typeof parsed.settings === 'object') ||
            Array.isArray(parsed.searchHistory);

        if (isModern && !parsed.data) {
            let watchlistCount = 0;
            let watchedCount = 0;
            let inboxCount = 0;
            let favoritePeopleCount = 0;

            if (Array.isArray(parsed.content)) {
                for (const item of parsed.content) {
                    if (!item || typeof item !== 'object') continue;
                    const tmdbId = Number(item.tmdbId ?? item.id);
                    if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;

                    const lists = Array.isArray(item.lists) ? item.lists : [];
                    if (item.mediaType === 'person' && lists.includes('favorite')) {
                        favoritePeopleCount++;
                    } else if (lists.includes('inbox')) {
                        inboxCount++;
                    } else if (lists.includes('watched')) {
                        watchedCount++;
                    } else if (lists.includes('watchlist')) {
                        watchlistCount++;
                    }
                }
            }

            const totalTitles = Array.isArray(parsed.content) ? parsed.content.length : 0;
            const historyCount = Array.isArray(parsed.searchHistory) ? parsed.searchHistory.length : 0;
            const hasSettings = Boolean(parsed.settings && typeof parsed.settings === 'object');
            const tvProgressCount = Array.isArray(parsed.tvProgress)
                ? parsed.tvProgress.filter((p) => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.tmdbId === 'number').length
                : 0;

            return {
                isValid: totalTitles > 0 || historyCount > 0 || hasSettings || tvProgressCount > 0,
                format: 'modern',
                version: parsed.version ?? 1,
                appVersion: parsed.appVersion,
                exportedAt: parsed.exportedAt,
                totalTitles,
                watchlistCount,
                watchedCount,
                inboxCount,
                favoritePeopleCount,
                historyCount,
                hasSettings,
                tvProgressCount
            };
        }

        // 2. Inspect Legacy CineScope v1 Format
        const legacyData = parsed.data;
        if (legacyData && typeof legacyData === 'object') {
            const watchlistCount = Array.isArray(legacyData.watchlist_contents) ? legacyData.watchlist_contents.length : 0;
            const watchedCount = Array.isArray(legacyData.watched_contents) ? legacyData.watched_contents.length : 0;
            const totalTitles = watchlistCount + watchedCount;
            const hasSettings = Boolean(legacyData.settings && typeof legacyData.settings === 'object');

            return {
                isValid: totalTitles > 0 || hasSettings,
                format: 'legacy',
                version: parsed.version ?? 1,
                exportedAt: parsed.createdAt,
                totalTitles,
                watchlistCount,
                watchedCount,
                inboxCount: 0,
                favoritePeopleCount: 0,
                historyCount: 0,
                hasSettings
            };
        }

        return {
            isValid: false,
            format: 'unknown',
            version: 0,
            totalTitles: 0,
            watchlistCount: 0,
            watchedCount: 0,
            inboxCount: 0,
            favoritePeopleCount: 0,
            historyCount: 0,
            hasSettings: false,
            error: 'The file does not contain recognized CineScope library records.'
        };
    }

    public async exportBackupJson(): Promise<string> {
        this.initReactiveStreams();
        const [settingsDoc, contentDocs, historyDocs, tvProgressDocs] = await Promise.all([
            this.dbService.db.settings.findOne('user_preferences').exec(),
            this.dbService.db.content.find().exec(),
            this.dbService.db.searchHistory.find().exec(),
            this.dbService.db.tvProgress.find().exec()
        ]);

        const payload: CinescopeBackupPayload = {
            version: 1,
            appVersion: '1.2.0',
            app: 'CineScope',
            exportedAt: new Date().toISOString(),
            settings: settingsDoc ? (settingsDoc.toJSON() as SettingsDocType) : null,
            content: contentDocs.map((d) => {
                const json = d.toJSON() as ContentDocType;
                const clean = { ...json };
                delete (clean as Record<string, unknown>)['_rev'];
                delete (clean as Record<string, unknown>)['_deleted'];
                delete (clean as Record<string, unknown>)['_meta'];
                delete (clean as Record<string, unknown>)['_attachments'];
                return clean;
            }),
            searchHistory: historyDocs.map((d) => {
                const json = d.toJSON() as SearchHistoryDocType;
                const clean = { ...json };
                delete (clean as Record<string, unknown>)['_rev'];
                delete (clean as Record<string, unknown>)['_deleted'];
                delete (clean as Record<string, unknown>)['_meta'];
                return clean;
            }),
            tvProgress: tvProgressDocs.map((d) => {
                const json = d.toJSON() as TvProgressDocType;
                const clean = { ...json };
                delete (clean as Record<string, unknown>)['_rev'];
                delete (clean as Record<string, unknown>)['_deleted'];
                delete (clean as Record<string, unknown>)['_meta'];
                return clean;
            })
        };

        return JSON.stringify(payload, null, 2);
    }

    public async importBackupJson(rawJson: string): Promise<BackupImportResult> {
        this.initReactiveStreams();
        const cleanJson = rawJson.replace(/^\uFEFF/, '').trim();
        const parsed = JSON.parse(cleanJson) as Partial<CinescopeBackupPayload> & LegacyBackupPayload;

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid backup file format.');
        }

        let watchlistCount = 0;
        let watchedCount = 0;
        let inboxCount = 0;
        let favoritePeopleCount = 0;
        let historyCount = 0;

        // 1. Restore Settings (supports both modern `parsed.settings` and Legacy v1 `parsed.data.settings`)
        const rawSettings = parsed.settings ?? parsed.data?.settings;
        if (rawSettings && typeof rawSettings === 'object') {
            const rawTheme = rawSettings.theme;
            const validTheme: 'system' | 'light' | 'dark' =
                rawTheme === 'light' || rawTheme === 'dark' || rawTheme === 'system' ? rawTheme : 'dark';

            await this.dbService.db.settings.upsert({
                id: 'user_preferences',
                allowAdultContent: Boolean(rawSettings.allowAdultContent),
                theme: validTheme,
                region: typeof (rawSettings as Record<string, unknown>)['region'] === 'string'
                    ? ((rawSettings as Record<string, unknown>)['region'] as string).trim().toUpperCase()
                    : 'IN',
                isManualRegion: Boolean((rawSettings as Record<string, unknown>)['isManualRegion']),
                appTourCompleted: rawSettings.appTourCompleted === undefined
                    ? true
                    : Boolean(rawSettings.appTourCompleted)
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

        // 3. Restore Modern Format (`parsed.content`) with strict schema normalization & sanitization
        if (Array.isArray(parsed.content)) {
            for (const raw of parsed.content) {
                if (!raw || typeof raw !== 'object') continue;

                const tmdbId = Number(raw.tmdbId ?? raw.id);
                if (!Number.isFinite(tmdbId) || tmdbId <= 0) continue;

                const mediaType = (raw.mediaType === 'tv' || raw.mediaType === 'person')
                    ? raw.mediaType
                    : 'movie';

                const docId = typeof raw.id === 'string' && raw.id.trim().length > 0
                    ? raw.id.trim()
                    : this.generateId(tmdbId, mediaType);

                const lists = Array.isArray(raw.lists) && raw.lists.length > 0
                    ? raw.lists.map(String)
                    : ['watchlist'];

                const addedAt = typeof raw.addedAt === 'string' && Number.isFinite(Date.parse(raw.addedAt))
                    ? raw.addedAt
                    : new Date().toISOString();

                const payload = raw.payload && typeof raw.payload === 'object'
                    ? (raw.payload as TmdbPayload)
                    : { id: tmdbId, media_type: mediaType };

                const cleanDoc: ContentDocType = {
                    id: docId,
                    tmdbId,
                    mediaType,
                    lists,
                    addedAt,
                    payload
                };

                if (raw.watchedAt && typeof raw.watchedAt === 'string' && Number.isFinite(Date.parse(raw.watchedAt))) {
                    cleanDoc.watchedAt = raw.watchedAt;
                }

                docsById.set(docId, cleanDoc);
            }
        }

        const docsToUpsert = Array.from(docsById.values());
        if (docsToUpsert.length > 0) {
            // Batch into chunks of 250 to ensure zero memory exhaustion and IndexedDB transaction limits
            const CHUNK_SIZE = 250;
            for (let i = 0; i < docsToUpsert.length; i += CHUNK_SIZE) {
                const chunk = docsToUpsert.slice(i, i + CHUNK_SIZE);
                await this.dbService.db.content.bulkUpsert(chunk);
            }

            for (const doc of docsToUpsert) {
                if (doc.mediaType === 'person' && doc.lists.includes('favorite')) {
                    favoritePeopleCount++;
                } else if (doc.lists.includes('inbox')) {
                    inboxCount++;
                } else if (doc.lists.includes('watched')) {
                    watchedCount++;
                } else if (doc.lists.includes('watchlist')) {
                    watchlistCount++;
                }
            }
        }

        // 4. Restore Search History (if present) in chunks
        if (Array.isArray(parsed.searchHistory)) {
            const validHistory: SearchHistoryDocType[] = [];
            for (const entry of parsed.searchHistory) {
                if (entry && typeof entry.query === 'string' && entry.query.trim().length > 0) {
                    const timestamp = typeof entry.timestamp === 'number' && Number.isFinite(entry.timestamp)
                        ? entry.timestamp
                        : Date.now();
                    validHistory.push({
                        query: entry.query.trim().slice(0, 100),
                        timestamp
                    });
                }
            }
            if (validHistory.length > 0) {
                const CHUNK_SIZE = 250;
                for (let i = 0; i < validHistory.length; i += CHUNK_SIZE) {
                    const chunk = validHistory.slice(i, i + CHUNK_SIZE);
                    await this.dbService.db.searchHistory.bulkUpsert(chunk);
                }
                historyCount = validHistory.length;
            }
        }

        // 5. Restore TV Progress (if present) in chunks
        let tvProgressCount = 0;
        if (Array.isArray(parsed.tvProgress)) {
            const validProgress: TvProgressDocType[] = [];
            for (const p of parsed.tvProgress) {
                if (p && typeof p.id === 'string' && typeof p.tmdbId === 'number' && Array.isArray(p.watchedEpisodes)) {
                    validProgress.push(p);
                }
            }
            if (validProgress.length > 0) {
                const CHUNK_SIZE = 100;
                for (let i = 0; i < validProgress.length; i += CHUNK_SIZE) {
                    const chunk = validProgress.slice(i, i + CHUNK_SIZE);
                    await this.dbService.db.tvProgress.bulkUpsert(chunk);
                }
                tvProgressCount = validProgress.length;
            }
        }

        return {
            contentCount: docsToUpsert.length,
            watchlistCount,
            watchedCount,
            inboxCount,
            favoritePeopleCount,
            historyCount,
            tvProgressCount
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

    public generateId(tmdbId: number, mediaType: 'movie' | 'tv' | 'person'): string {
        return `${mediaType}_${tmdbId}`;
    }
}