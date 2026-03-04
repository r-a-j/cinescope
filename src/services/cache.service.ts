import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
    providedIn: 'root'
})
export class CacheService {
    private readonly CACHE_PREFIX = 'tmdb_cache_';
    private readonly DEFAULT_TTL = 1000 * 60 * 60 * 6;

    constructor() { }

    async get(key: string): Promise<any | null> {
        try {
            const { value } = await Preferences.get({ key: this.CACHE_PREFIX + key });
            if (!value) return null;

            const entry = JSON.parse(value);
            if (Date.now() > entry.expiry) {
                this.remove(key).catch(e => console.warn('Cache cleanup failed', e));
                return null;
            }
            return entry.data;
        } catch (e) {
            console.error('[Cache] Parse error', e);
            return null;
        }
    }

    async set(key: string, data: any, ttlMs: number = this.DEFAULT_TTL): Promise<void> {
        try {
            const entry = {
                expiry: Date.now() + ttlMs,
                data: data
            };
            await Preferences.set({
                key: this.CACHE_PREFIX + key,
                value: JSON.stringify(entry)
            });
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.message?.includes('exceeded the quota')) {
                console.warn('[Cache] Storage full! Clearing cache to make room...');
                await this.clearAll();
            } else {
                console.error('[Cache] Set error', e);
            }
        }
    }

    async remove(key: string): Promise<void> {
        await Preferences.remove({ key: this.CACHE_PREFIX + key });
    }

    async clearAll(): Promise<void> {
        const { keys } = await Preferences.keys();
        const cacheKeys = keys.filter(k => k.startsWith(this.CACHE_PREFIX));
        for (const key of cacheKeys) {
            await Preferences.remove({ key });
        }
    }
}