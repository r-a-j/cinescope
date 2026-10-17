import { Component, ChangeDetectionStrategy, input, output, inject, signal, computed } from '@angular/core';
import { PosterCacheService } from '../../../core/services/poster-cache.service';
import { DEFAULT_POSTER_PLACEHOLDER } from '../../../core/constants/api.constants';

export type BookmarkState = 'none' | 'watchlist' | 'watched';

@Component({
    selector: 'app-poster-card',
    standalone: true,
    imports: [],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './poster-card.component.html',
    styleUrls: ['./poster-card.component.scss']
})
export class PosterCardComponent {
    private readonly posterCache = inject(PosterCacheService);

    public imageUrl = input<string>(DEFAULT_POSTER_PLACEHOLDER);
    public title = input<string | undefined>();
    public showBookmark = input<boolean>(false);
    public bookmarkState = input<BookmarkState>('none');
    public priority = input<boolean>(false);

    private readonly loadedUrl = signal<string | null>(null);
    private readonly erroredUrl = signal<string | null>(null);

    /**
     * Synchronously resolves on Frame 0 (unlike `effect()`, which runs after first paint).
     */
    public readonly resolvedImageUrl = computed<string>(() => {
        const raw = this.imageUrl();
        if (raw && this.erroredUrl() === raw) {
            return DEFAULT_POSTER_PLACEHOLDER;
        }
        return this.posterCache.resolveFallbackUrl(raw);
    });

    public readonly isCached = computed<boolean>(() => {
        return this.posterCache.isWarm(this.imageUrl());
    });

    public readonly isLoaded = computed<boolean>(() => {
        const raw = this.imageUrl();
        return this.isCached() || this.loadedUrl() === raw || this.erroredUrl() === raw;
    });

    public bookmarkToggle = output();
    public cardClick = output();

    public handleImageLoad(event: Event): void {
        const imgElement = event.target as HTMLImageElement;
        if (imgElement.complete && imgElement.naturalWidth > 0) {
            const raw = this.imageUrl();
            this.loadedUrl.set(raw);
            this.posterCache.markLoaded(raw, imgElement);
        }
    }

    public onBookmarkClick(event: Event): void {
        event.stopPropagation();
        this.bookmarkToggle.emit();
    }

    public onCardClick(): void {
        this.cardClick.emit();
    }

    /**
     * EDGE CASE FIX: If TMDB returns a dead image link, 
     * this forces the img tag to swap back to our local placeholder.
     */
    public handleImageError(event: Event): void {
        const imgElement = event.target as HTMLImageElement;
        imgElement.src = DEFAULT_POSTER_PLACEHOLDER;
        this.erroredUrl.set(this.imageUrl());
    }
}