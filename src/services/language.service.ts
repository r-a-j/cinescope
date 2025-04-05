import { Injectable } from '@angular/core';
import { LanguageList } from 'src/models/language.model';
import languageData from '../assets/language.json';

@Injectable({ providedIn: 'root' })
export class LanguageService {
    public languages: LanguageList[] = languageData;
    private languageMap = new Map<string, string>();

    constructor() {
        for (const lang of this.languages) {
            this.languageMap.set(lang.english_name.toLowerCase(), lang.iso_639_1);
        }
    }

    extractLanguageFromQuery(query: string): string | null {
        const words = query.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (this.languageMap.has(word)) {
                return this.languageMap.get(word)!;
            }
        }

        // fuzzy match fallback
        for (const key of this.languageMap.keys()) {
            if (query.toLowerCase().includes(key)) {
                return this.languageMap.get(key)!;
            }
        }

        return null;
    }
}
