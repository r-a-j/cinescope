import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosterCardComponent, BookmarkState } from '../poster-card/poster-card.component';
import { SwimlaneItem } from '../../models/swimlane-item.interface';
import { StorageService } from '../../../core/services/storage.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
    selector: 'app-swimlane',
    standalone: true,
    imports: [CommonModule, PosterCardComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './swimlane.component.html',
    styleUrls: ['./swimlane.component.scss']
})
export class SwimlaneComponent {
    private storageService = inject(StorageService);
    private toastService = inject(ToastService);

    public title = input.required<string>();
    public items = input.required<SwimlaneItem[]>();

    public getItemBookmarkState(item: SwimlaneItem): BookmarkState {
        const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
        return this.storageService.getBookmarkState(item.id, mediaType);
    }

    public async onToggleBookmark(item: SwimlaneItem): Promise<void> {
        if (item.mediaType === 'person') return;
        const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
        const payload = item.payload || {
            id: Number(item.id),
            title: item.title,
            name: item.title,
            posterUrl: item.posterUrl,
            media_type: mediaType
        };

        const nextState = await this.storageService.cycleBookmark(Number(item.id), mediaType, payload);
        if (nextState === 'watchlist') {
            await this.toastService.presentSuccess(`Added "${item.title}" to Watchlist`, 1800);
        } else if (nextState === 'watched') {
            await this.toastService.presentInfo(`Marked "${item.title}" as Watched`, 1800);
        } else {
            await this.toastService.presentWarning(`Removed "${item.title}" from Archive`, 1800);
        }
    }
}