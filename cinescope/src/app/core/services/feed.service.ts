import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FeedItem, FeedResponseDto } from '../dtos/feed/feed.dto';

@Injectable({
    providedIn: 'root'
})
export class FeedService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/feed`;

    // Dynamic sources provided by other services or components
    // If empty, the backend will use its default seed sources
    sources = signal<string[]>([]);

    feedItems = signal<FeedItem[]>([]);
    isLoading = signal<boolean>(false);
    activeFilter = signal<string>('All');
    sortDirection = signal<'newest' | 'oldest'>('newest');
    visibleLimit = signal<number>(12);

    availableSources = computed(() => {
        const items = this.feedItems();
        const names = items.map(item => item.sourceName).filter(Boolean);
        return ['All', ...new Set(names)];
    });

    displayedItems = computed(() => {
        let items = [...this.feedItems()];

        if (this.activeFilter() !== 'All') {
            items = items.filter(item => item.sourceName === this.activeFilter());
        }

        const direction = this.sortDirection();
        items.sort((a, b) => {
            const timeA = new Date(a.pubDate || 0).getTime();
            const timeB = new Date(b.pubDate || 0).getTime();
            return direction === 'newest' ? timeB - timeA : timeA - timeB;
        });

        return items.slice(0, this.visibleLimit());
    });

    async refreshFeed(): Promise<void> {
        this.isLoading.set(true);

        const headers = new HttpHeaders({
            'x-cinescope-client': 'CS-Mobile-App-2026'
        });

        const sourcesToFetch = this.sources();

        try {
            let response: FeedResponseDto;

            // If sources are provided, use POST, otherwise use GET (which falls back to API default seeds)
            if (sourcesToFetch.length > 0) {
                response = await firstValueFrom(
                    this.http.post<FeedResponseDto>(this.apiUrl, { sources: sourcesToFetch }, { headers })
                );
            } else {
                response = await firstValueFrom(
                    this.http.get<FeedResponseDto>(this.apiUrl, { headers })
                );
            }

            if (response.status === 'ok') {
                this.feedItems.set(response.items || []);
            } else {
                console.error('API returned an error state:', response.errors);
                // Also set any items that were successful (since Promise.allSettled might return partial successes)
                if (response.items) {
                    this.feedItems.set(response.items);
                }
            }

        } catch (error) {
            console.error('Failed to fetch feeds from backend', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    loadMore(): void {
        this.visibleLimit.update(current => current + 12);
    }

    addSource(url: string): void {
        const currentSources = this.sources();
        if (!currentSources.includes(url)) {
            // Check limits before blindly adding (API limits to 5)
            if (currentSources.length >= 5) {
                console.warn('Cannot add more than 5 custom sources.');
                return;
            }
            this.sources.update(current => [...current, url]);
            this.refreshFeed();
        }
    }

    removeSource(url: string): void {
        this.sources.update(current => current.filter(s => s !== url));
        this.refreshFeed();
    }
}
