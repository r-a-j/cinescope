import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline } from 'ionicons/icons';
import { PosterCardComponent, BookmarkState } from '../poster-card/poster-card.component';
import { SwimlaneItem } from '../../models/swimlane-item.interface';
import { StorageService } from '../../../core/services/storage.service';
import { ToastService } from '../../../core/services/toast.service';
import { resolveMediaImageUrl } from '../../../core/constants/api.constants';
import { CollectionQueryContext } from '../../../core/services/collection-loader.service';

@Component({
    selector: 'app-swimlane',
    standalone: true,
    imports: [CommonModule, PosterCardComponent, IonIcon],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './swimlane.component.html',
    styleUrls: ['./swimlane.component.scss']
})
export class SwimlaneComponent {
    private storageService = inject(StorageService);
    private toastService = inject(ToastService);
    private router = inject(Router);

    public title = input.required<string>();
    public items = input.required<SwimlaneItem[]>();
    public queryContext = input<CollectionQueryContext>();

    constructor() {
        addIcons({ chevronForwardOutline });
    }

    public openViewAll(): void {
        const query = this.queryContext();
        const baseSlug = (query?.type ? `${query.type}-${query.id ?? ''}` : this.title())
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'all';

        const collectionId = `${baseSlug}-${Date.now()}`;

        const queryParams: Record<string, string | number> = {
            title: this.title()
        };
        if (query?.type) queryParams['type'] = query.type;
        if (query?.id !== undefined) queryParams['id'] = query.id;
        if (query?.mediaType) queryParams['mediaType'] = query.mediaType;

        void this.router.navigate(['/collection', collectionId], {
            queryParams,
            state: {
                title: this.title(),
                items: this.items(),
                queryContext: this.queryContext()
            }
        });
    }

    public getItemBookmarkState(item: SwimlaneItem): BookmarkState {
        if (item.mediaType === 'person') return 'none';
        const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
        return this.storageService.getBookmarkState(item.id, mediaType);
    }

    public onCardClick(item: SwimlaneItem): void {
        if (item.mediaType === 'person') {
            void this.router.navigate(['/person', item.id], {
                state: {
                    preview: {
                        id: Number(item.id),
                        name: item.title,
                        profileUrl: item.posterUrl,
                        knownForDepartment: item.subtitle
                    }
                }
            });
            return;
        }
        const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
        const rawBackdrop = item.payload?.['backdrop_path'] as string | undefined;
        void this.router.navigate(['/media', mediaType, item.id], {
            state: {
                preview: {
                    id: Number(item.id),
                    mediaType,
                    title: item.title,
                    posterUrl: item.posterUrl,
                    backdropUrl: rawBackdrop ? resolveMediaImageUrl(rawBackdrop, 'w1280') : undefined
                }
            }
        });
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
