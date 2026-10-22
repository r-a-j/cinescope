import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RateLimitRecord {
    count: number;
    resetTime: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

let lastCleanup = Date.now();
function cleanupExpired(now: number): void {
    if (now - lastCleanup > 300_000) {
        lastCleanup = now;
        for (const [key, record] of memoryStore.entries()) {
            if (now > record.resetTime) {
                memoryStore.delete(key);
            }
        }
    }
}

export interface RateLimitOptions {
    /** Time window in seconds (default: 60) */
    windowSec?: number;
    /** Maximum requests allowed in the time window (default: 30) */
    maxRequests?: number;
}

/**
 * Lightweight sliding-window rate limiter per client IP and endpoint.
 * Returns true if request is permitted, or false if request was blocked (and sets 429 response).
 */
export function checkRateLimit(
    req: VercelRequest,
    res: VercelResponse,
    options: RateLimitOptions = {}
): boolean {
    const { windowSec = 60, maxRequests = 30 } = options;

    const rawForwarded = req.headers['x-forwarded-for'];
    const forwardedStr = Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded;
    const clientIp = (forwardedStr ? forwardedStr.split(',')[0].trim() : undefined)
        || (typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : undefined)
        || req.socket?.remoteAddress
        || 'unknown-ip';

    const pathKey = req.url?.split('?')[0] || 'endpoint';
    const key = `${clientIp}:${pathKey}`;
    const now = Date.now();

    cleanupExpired(now);

    const record = memoryStore.get(key);

    if (!record || now > record.resetTime) {
        memoryStore.set(key, {
            count: 1,
            resetTime: now + (windowSec * 1000)
        });
        return true;
    }

    if (record.count >= maxRequests) {
        const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
            error: 'Too many requests. Please slow down and try again later.',
            retryAfter: retryAfterSeconds
        });
        return false;
    }

    record.count += 1;
    return true;
}
