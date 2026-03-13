import { Component, ChangeDetectionStrategy, input } from '@angular/core';

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
    public imageUrl = input<string>('assets/placeholders/placeholder.webp');
    public title = input<string | undefined>();
    public showBookmark = input<boolean>(false);

    public bookmarkState = input<BookmarkState>('none');
    /**
     * EDGE CASE FIX: If TMDB returns a dead image link, 
     * this forces the img tag to swap back to our local placeholder.
     */
    public handleImageError(event: Event): void {
        const imgElement = event.target as HTMLImageElement;
        imgElement.src = 'assets/placeholders/placeholder.webp';
    }
}