import { Injectable } from '@angular/core';
import { TmdbWatchRegionDto } from 'src/app/core/dtos/watch-providers/watch-provider.dto';

export interface RegionDetectionResult {
    resolvedRegion: string;
    signals: {
        locale: string | null;
        timezone: string | null;
        ip: string | null;
    };
    confidence: 'high' | 'medium' | 'fallback';
    isFallbackToIndia: boolean;
}

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
    // India & Subcontinent
    'Asia/Kolkata': 'IN',
    'Asia/Calcutta': 'IN',
    'Asia/Colombo': 'LK',
    'Asia/Karachi': 'PK',
    'Asia/Kathmandu': 'NP',
    'Asia/Katmandu': 'NP',
    'Asia/Dhaka': 'BD',

    // Germany & Central Europe
    'Europe/Berlin': 'DE',
    'Europe/Busingen': 'DE',
    'Europe/Vienna': 'AT',
    'Europe/Zurich': 'CH',
    'Europe/Vaduz': 'LI',

    // United Kingdom & Ireland
    'Europe/London': 'GB',
    'Europe/Belfast': 'GB',
    'Europe/Dublin': 'IE',

    // United States
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Los_Angeles': 'US',
    'America/Phoenix': 'US',
    'America/Anchorage': 'US',
    'America/Honolulu': 'US',
    'America/Detroit': 'US',
    'America/Boise': 'US',
    'America/Juneau': 'US',
    'America/Adak': 'US',
    'America/Menominee': 'US',

    // Canada
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Montreal': 'CA',
    'America/Edmonton': 'CA',
    'America/Winnipeg': 'CA',
    'America/Halifax': 'CA',
    'America/St_Johns': 'CA',
    'America/Regina': 'CA',
    'America/Whitehorse': 'CA',

    // Australia & New Zealand
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Perth': 'AU',
    'Australia/Adelaide': 'AU',
    'Australia/Hobart': 'AU',
    'Australia/Darwin': 'AU',
    'Pacific/Auckland': 'NZ',
    'Pacific/Chatham': 'NZ',

    // France, Spain, Portugal, Italy
    'Europe/Paris': 'FR',
    'Europe/Madrid': 'ES',
    'Atlantic/Canary': 'ES',
    'Europe/Lisbon': 'PT',
    'Atlantic/Madeira': 'PT',
    'Europe/Rome': 'IT',

    // Benelux
    'Europe/Amsterdam': 'NL',
    'Europe/Brussels': 'BE',
    'Europe/Luxembourg': 'LU',

    // Nordics
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Helsinki': 'FI',
    'Europe/Copenhagen': 'DK',
    'Atlantic/Reykjavik': 'IS',

    // Eastern & Southern Europe
    'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ',
    'Europe/Bratislava': 'SK',
    'Europe/Budapest': 'HU',
    'Europe/Bucharest': 'RO',
    'Europe/Sofia': 'BG',
    'Europe/Zagreb': 'HR',
    'Europe/Athens': 'GR',
    'Europe/Tallinn': 'EE',
    'Europe/Riga': 'LV',
    'Europe/Vilnius': 'LT',

    // East Asia
    'Asia/Tokyo': 'JP',
    'Asia/Seoul': 'KR',
    'Asia/Hong_Kong': 'HK',
    'Asia/Taipei': 'TW',
    'Asia/Shanghai': 'CN',

    // Southeast Asia
    'Asia/Singapore': 'SG',
    'Asia/Kuala_Lumpur': 'MY',
    'Asia/Kuching': 'MY',
    'Asia/Bangkok': 'TH',
    'Asia/Jakarta': 'ID',
    'Asia/Makassar': 'ID',
    'Asia/Jayapura': 'ID',
    'Asia/Manila': 'PH',
    'Asia/Ho_Chi_Minh': 'VN',

    // Middle East
    'Asia/Dubai': 'AE',
    'Asia/Riyadh': 'SA',
    'Asia/Qatar': 'QA',
    'Asia/Kuwait': 'KW',
    'Asia/Bahrain': 'BH',
    'Asia/Muscat': 'OM',
    'Asia/Jerusalem': 'IL',
    'Europe/Istanbul': 'TR',

    // Latin America
    'America/Sao_Paulo': 'BR',
    'America/Fortaleza': 'BR',
    'America/Manaus': 'BR',
    'America/Recife': 'BR',
    'America/Belem': 'BR',
    'America/Cuiaba': 'BR',
    'America/Mexico_City': 'MX',
    'America/Cancun': 'MX',
    'America/Monterrey': 'MX',
    'America/Tijuana': 'MX',
    'America/Buenos_Aires': 'AR',
    'America/Cordoba': 'AR',
    'America/Santiago': 'CL',
    'America/Bogota': 'CO',
    'America/Lima': 'PE',

    // Africa
    'Africa/Johannesburg': 'ZA',
    'Africa/Cairo': 'EG',
    'Africa/Lagos': 'NG',
    'Africa/Nairobi': 'KE'
};

export const STATIC_FALLBACK_REGIONS: TmdbWatchRegionDto[] = [
    { iso_3166_1: 'AR', english_name: 'Argentina', native_name: 'Argentina' },
    { iso_3166_1: 'AT', english_name: 'Austria', native_name: 'Österreich' },
    { iso_3166_1: 'AU', english_name: 'Australia', native_name: 'Australia' },
    { iso_3166_1: 'BE', english_name: 'Belgium', native_name: 'Belgique' },
    { iso_3166_1: 'BR', english_name: 'Brazil', native_name: 'Brasil' },
    { iso_3166_1: 'CA', english_name: 'Canada', native_name: 'Canada' },
    { iso_3166_1: 'CH', english_name: 'Switzerland', native_name: 'Schweiz' },
    { iso_3166_1: 'CL', english_name: 'Chile', native_name: 'Chile' },
    { iso_3166_1: 'CO', english_name: 'Colombia', native_name: 'Colombia' },
    { iso_3166_1: 'CZ', english_name: 'Czech Republic', native_name: 'Česká republika' },
    { iso_3166_1: 'DE', english_name: 'Germany', native_name: 'Deutschland' },
    { iso_3166_1: 'DK', english_name: 'Denmark', native_name: 'Danmark' },
    { iso_3166_1: 'EE', english_name: 'Estonia', native_name: 'Eesti' },
    { iso_3166_1: 'ES', english_name: 'Spain', native_name: 'España' },
    { iso_3166_1: 'FI', english_name: 'Finland', native_name: 'Suomi' },
    { iso_3166_1: 'FR', english_name: 'France', native_name: 'France' },
    { iso_3166_1: 'GB', english_name: 'United Kingdom', native_name: 'United Kingdom' },
    { iso_3166_1: 'GR', english_name: 'Greece', native_name: 'Ελλάδα' },
    { iso_3166_1: 'HK', english_name: 'Hong Kong', native_name: '香港' },
    { iso_3166_1: 'HR', english_name: 'Croatia', native_name: 'Hrvatska' },
    { iso_3166_1: 'HU', english_name: 'Hungary', native_name: 'Magyarország' },
    { iso_3166_1: 'ID', english_name: 'Indonesia', native_name: 'Indonesia' },
    { iso_3166_1: 'IE', english_name: 'Ireland', native_name: 'Ireland' },
    { iso_3166_1: 'IN', english_name: 'India', native_name: 'India' },
    { iso_3166_1: 'IT', english_name: 'Italy', native_name: 'Italia' },
    { iso_3166_1: 'JP', english_name: 'Japan', native_name: '日本' },
    { iso_3166_1: 'KR', english_name: 'South Korea', native_name: '대한민국' },
    { iso_3166_1: 'LT', english_name: 'Lithuania', native_name: 'Lietuva' },
    { iso_3166_1: 'LV', english_name: 'Latvia', native_name: 'Latvija' },
    { iso_3166_1: 'MX', english_name: 'Mexico', native_name: 'México' },
    { iso_3166_1: 'MY', english_name: 'Malaysia', native_name: 'Malaysia' },
    { iso_3166_1: 'NL', english_name: 'Netherlands', native_name: 'Nederland' },
    { iso_3166_1: 'NO', english_name: 'Norway', native_name: 'Norge' },
    { iso_3166_1: 'NZ', english_name: 'New Zealand', native_name: 'New Zealand' },
    { iso_3166_1: 'PE', english_name: 'Peru', native_name: 'Perú' },
    { iso_3166_1: 'PH', english_name: 'Philippines', native_name: 'Pilipinas' },
    { iso_3166_1: 'PL', english_name: 'Poland', native_name: 'Polska' },
    { iso_3166_1: 'PT', english_name: 'Portugal', native_name: 'Portugal' },
    { iso_3166_1: 'RO', english_name: 'Romania', native_name: 'România' },
    { iso_3166_1: 'SA', english_name: 'Saudi Arabia', native_name: 'المملكة العربية السعودية' },
    { iso_3166_1: 'SE', english_name: 'Sweden', native_name: 'Sverige' },
    { iso_3166_1: 'SG', english_name: 'Singapore', native_name: 'Singapore' },
    { iso_3166_1: 'SK', english_name: 'Slovakia', native_name: 'Slovensko' },
    { iso_3166_1: 'TH', english_name: 'Thailand', native_name: 'ประเทศไทย' },
    { iso_3166_1: 'TR', english_name: 'Turkey', native_name: 'Türkiye' },
    { iso_3166_1: 'TW', english_name: 'Taiwan', native_name: '臺灣' },
    { iso_3166_1: 'US', english_name: 'United States', native_name: 'United States' },
    { iso_3166_1: 'ZA', english_name: 'South Africa', native_name: 'South Africa' }
];

@Injectable({
    providedIn: 'root'
})
export class RegionService {

    /**
     * Executes the 3-signal consensus detection:
     * Signal 1: Device Locale (Intl.Locale / navigator.language)
     * Signal 2: Device Timezone (Intl.DateTimeFormat mapped to ISO)
     * Signal 3: Network IP Geolocation (Cloudflare Edge trace)
     *
     * Fallback guarantee: if signals are unavailable or inconclusive, defaults to 'IN'.
     */
    public async detectRegion(): Promise<RegionDetectionResult> {
        const localeSignal = this.detectLocaleRegion();
        const timezoneSignal = this.detectTimezoneRegion();

        // 1. High confidence: Hardware & OS signals agree (Locale === Timezone).
        // This is prioritized above network IP because users on VPN or proxy often have
        // remote IPs while their system language and timezone reflect their actual location.
        // Returning early also eliminates unnecessary external network calls and ad-blocker conflicts.
        if (localeSignal && timezoneSignal && localeSignal === timezoneSignal) {
            return {
                resolvedRegion: localeSignal,
                signals: {
                    locale: localeSignal,
                    timezone: timezoneSignal,
                    ip: null
                },
                confidence: 'high',
                isFallbackToIndia: false
            };
        }

        // 2. If device signals differ or are inconclusive, attempt network IP lookup
        const ipSignal = await this.detectIpRegion();

        const signals = {
            locale: localeSignal,
            timezone: timezoneSignal,
            ip: ipSignal
        };

        // 3. High confidence: All 3 signals match
        if (ipSignal && localeSignal === ipSignal && timezoneSignal === ipSignal) {
            return {
                resolvedRegion: ipSignal,
                signals,
                confidence: 'high',
                isFallbackToIndia: false
            };
        }

        // 4. High confidence: Network IP matches either Locale or Timezone
        if (ipSignal && (ipSignal === localeSignal || ipSignal === timezoneSignal)) {
            return {
                resolvedRegion: ipSignal,
                signals,
                confidence: 'high',
                isFallbackToIndia: false
            };
        }

        // 5. Medium confidence: Timezone mapped code
        if (timezoneSignal && timezoneSignal.length === 2) {
            return {
                resolvedRegion: timezoneSignal,
                signals,
                confidence: 'medium',
                isFallbackToIndia: false
            };
        }

        // 6. Medium confidence: Network IP returned a valid 2-letter code
        if (ipSignal && ipSignal.length === 2) {
            return {
                resolvedRegion: ipSignal,
                signals,
                confidence: 'medium',
                isFallbackToIndia: false
            };
        }

        // 7. Medium confidence: Locale mapped code
        if (localeSignal && localeSignal.length === 2) {
            return {
                resolvedRegion: localeSignal,
                signals,
                confidence: 'medium',
                isFallbackToIndia: false
            };
        }

        // 8. Final safety fallback: default to India (IN)
        return {
            resolvedRegion: 'IN',
            signals,
            confidence: 'fallback',
            isFallbackToIndia: true
        };
    }

    /**
     * Returns the built-in offline regions list
     */
    public getStaticFallbackRegions(): TmdbWatchRegionDto[] {
        return STATIC_FALLBACK_REGIONS;
    }

    /**
     * Resolves human-readable English country name using Intl.DisplayNames
     */
    public resolveCountryName(countryCode: string): string {
        if (!countryCode || countryCode.length !== 2) return countryCode;
        try {
            const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
            const resolved = displayNames.of(countryCode.toUpperCase());
            if (resolved) return resolved;
        } catch {
            // Fallback to static list or raw code
        }
        const match = STATIC_FALLBACK_REGIONS.find((r) => r.iso_3166_1 === countryCode.toUpperCase());
        return match?.english_name || countryCode.toUpperCase();
    }

    /**
     * Signal 1: Extract country code from navigator.language or Intl.Locale
     */
    public detectLocaleRegion(): string | null {
        try {
            if (typeof Intl !== 'undefined' && 'Locale' in Intl && navigator.language) {
                const loc = new Intl.Locale(navigator.language);
                if (loc.region && loc.region.length === 2) {
                    return loc.region.toUpperCase();
                }
            }

            const lang = navigator.language || (navigator.languages && navigator.languages[0]);
            if (lang && lang.includes('-')) {
                const parts = lang.split('-');
                const region = parts[parts.length - 1];
                if (region && region.length === 2 && /^[a-zA-Z]{2}$/.test(region)) {
                    return region.toUpperCase();
                }
            }
        } catch (err) {
            console.warn('[RegionService] Locale detection failed:', err);
        }
        return null;
    }

    /**
     * Signal 2: Extract country code from device timezone
     */
    public detectTimezoneRegion(): string | null {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (!tz) return null;

            if (TIMEZONE_TO_COUNTRY[tz]) {
                return TIMEZONE_TO_COUNTRY[tz];
            }

            // Prefix checks for dynamic sub-regions
            if (
                tz.startsWith('America/Indiana/') ||
                tz.startsWith('America/Kentucky/') ||
                tz.startsWith('America/North_Dakota/') ||
                tz.startsWith('US/')
            ) {
                return 'US';
            }
            if (tz.startsWith('Australia/')) {
                return 'AU';
            }
            if (tz.startsWith('Canada/')) {
                return 'CA';
            }
            if (tz.startsWith('America/Argentina/')) {
                return 'AR';
            }
        } catch (err) {
            console.warn('[RegionService] Timezone detection failed:', err);
        }
        return null;
    }

    /**
     * Signal 3: Network IP lookup with timeout
     * Queries Cloudflare's trace service (https://cloudflare.com/cdn-cgi/trace) via standard domain,
     * which avoids raw IP ad-blocker rules and returns the 2-letter ISO country code.
     */
    public async detectIpRegion(): Promise<string | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch('https://cloudflare.com/cdn-cgi/trace', {
                signal: controller.signal,
                headers: { 'Accept': 'text/plain' }
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const text = await response.text();
                const match = text.match(/loc=([A-Z]{2})/i);
                if (match && match[1]) {
                    return match[1].toUpperCase();
                }
            }
        } catch {
            // Gracefully fall back if offline or blocked
        }

        return null;
    }
}
