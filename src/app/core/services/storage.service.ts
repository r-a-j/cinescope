import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { ContentDocType } from '../database/schemas/content.schema';
import { SettingsDocType } from '../database/schemas/settings.schema';

// Enterprise strict type for generic JSON objects (replaces 'any')
export type TmdbPayload = Record<string, unknown>;

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    private dbService = inject(DatabaseService);

    // ==========================================
    // 📡 REACTIVE STREAMS (For the UI)
    // ==========================================

    public getWatchlist$(): Observable<ContentDocType[]> {
        return this.dbService.db.content.find({
            selector: { lists: { $in: ['watchlist'] } },
            sort: [{ addedAt: 'desc' }]
        }).$;
    }

    public getWatched$(): Observable<ContentDocType[]> {
        return this.dbService.db.content.find({
            selector: { lists: { $in: ['watched'] } },
            sort: [{ addedAt: 'desc' }]
        }).$;
    }

    public async getSettings(): Promise<SettingsDocType | null> {
        return this.dbService.db.settings.findOne('user_preferences').exec();
    }

    // ==========================================
    // 💾 IMPERATIVE READS (For initial loads)
    // ==========================================

    public async getWatchlist(): Promise<ContentDocType[]> {
        return this.dbService.db.content.find({
            selector: { lists: { $in: ['watchlist'] } }
        }).exec();
    }

    public async getWatched(): Promise<ContentDocType[]> {
        return this.dbService.db.content.find({
            selector: { lists: { $in: ['watched'] } }
        }).exec();
    }

    // ==========================================
    // ✍️ MUTATIONS (Write, Update, Delete)
    // ==========================================

    public async updateSettings(updates: Partial<SettingsDocType>): Promise<void> {
        const doc = await this.dbService.db.settings.findOne('user_preferences').exec();
        if (doc) {
            // incrementalPatch safely updates only the provided fields without overwriting the rest
            await doc.incrementalPatch(updates);
        }
    }

    public async addToWatchlist(tmdbId: number, mediaType: 'movie' | 'tv' | 'person', payload: TmdbPayload): Promise<void> {
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

    public async moveToWatched(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
        const docId: string = this.generateId(tmdbId, mediaType);
        const doc = await this.dbService.db.content.findOne(docId).exec();

        if (doc) {
            await doc.incrementalModify((docData: ContentDocType): ContentDocType => {
                docData.lists = ['watched']; // Overwrite lists to only be 'watched'
                docData.watchedAt = new Date().toISOString();
                return docData;
            });
        }
    }

    public async removeMedia(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
        const docId: string = this.generateId(tmdbId, mediaType);
        const doc = await this.dbService.db.content.findOne(docId).exec();

        if (doc) {
            await doc.remove();
        }
    }

    // ==========================================
    // 🚀 BULK OPERATIONS (For Long-Press UI)
    // ==========================================

    public async bulkMoveToWatched(tmdbIds: number[], mediaType: 'movie' | 'tv'): Promise<void> {
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
        const docIds: string[] = tmdbIds.map((id: number): string => this.generateId(id, mediaType));

        const docs = await this.dbService.db.content.find({
            selector: { id: { $in: docIds } }
        }).exec();

        const promises: Promise<unknown>[] = docs.map((doc) => doc.remove());
        await Promise.all(promises);
    }

    // ==========================================
    // ⚙️ UTILITIES
    // ==========================================

    private generateId(tmdbId: number, mediaType: 'movie' | 'tv' | 'person'): string {
        return `${mediaType}_${tmdbId}`;
    }
}