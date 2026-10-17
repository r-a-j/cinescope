// Any service or interceptor that needs to route through the Vercel BFF uses this
export const MEDIA_API_PREFIX = '/media-data';

export const CINESCOPE_CLIENT_HEADER = 'CS-Mobile-App-2026';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const DEFAULT_POSTER_PLACEHOLDER = 'assets/placeholders/placeholder.webp';

/**
 * Safely resolves a TMDB relative path (e.g. "/abc.jpg"), a full external URL
 * (e.g. "https://commons.wikimedia.org/..."), or null/undefined into a valid image src.
 */
export function resolveMediaImageUrl(
    path: string | null | undefined,
    size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500',
    fallback: string = DEFAULT_POSTER_PLACEHOLDER
): string {
    if (!path) {
        return fallback;
    }
    if (path.startsWith('assets/') || path.startsWith('blob:')) {
        return path;
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
        if (path.includes('image.tmdb.org/t/p/')) {
            return path.replace(/image\.tmdb\.org\/t\/p\/[^/]+\//, `image.tmdb.org/t/p/${size}/`);
        }
        return path;
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${TMDB_IMAGE_BASE}${size}${normalizedPath}`;
}