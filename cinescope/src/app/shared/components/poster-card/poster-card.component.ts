import { Component, ChangeDetectionStrategy, input, output, inject, signal, effect } from '@angular/core';
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

    public resolvedImageUrl = signal<string>(DEFAULT_POSTER_PLACEHOLDER);

    public bookmarkToggle = output();
    public cardClick = output();

    constructor() {
        effect(() => {
            const rawUrl = this.imageUrl();
            const immediate = this.posterCache.getImmediateUrl(rawUrl);
            if (immediate) {
                this.resolvedImageUrl.set(immediate);
                return;
            }
            // Set placeholder or raw URL while checking persistent CacheStorage (~1ms)
            this.resolvedImageUrl.set(rawUrl || DEFAULT_POSTER_PLACEHOLDER);
            void this.posterCache.resolvePosterUrl(rawUrl).then((resolved) => {
                if (this.imageUrl() === rawUrl && this.resolvedImageUrl() !== resolved) {
                    this.resolvedImageUrl.set(resolved);
                }
            });
        });
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
    }
}