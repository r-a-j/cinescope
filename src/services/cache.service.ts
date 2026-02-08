import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
    providedIn: 'root'
})
export class CacheService {
    private readonly CACHE_PREFIX = 'tmdb_cache_';
    private readonly DEFAULT_TTL = 1000 * 60 * 60 * 6; // 6 hours

    constructor() { }

    async get(key: string): Promise<any | null> {
        const { value } = await Preferences.get({ key: this.CACHE_PREFIX + key });
        if (!value) return null;

        try {
            const entry = JSON.parse(value);
            if (Date.now() > entry.expiry) {
                await this.remove(key);
                return null;
            }
            return entry.data;
        } catch (e) {
            console.error('Cache parse error', e);
            return null;
        }
    }

    async set(key: string, data: any, ttlMs: number = this.DEFAULT_TTL): Promise<void> {
        const entry = {
            expiry: Date.now() + ttlMs,
            data: data
        };
        await Preferences.set({
            key: this.CACHE_PREFIX + key,
            value: JSON.stringify(entry)
        });
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
