import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, heart, heartOutline } from 'ionicons/icons';
import { PosterCardComponent, BookmarkState } from '../poster-card/poster-card.component';
import { SwimlaneItem } from '../../models/swimlane-item.interface';
import { StorageService, extractPersonCreditMetadata } from '../../../core/services/storage.service';
import { TmdbPeopleService } from '../../../core/services/tmdb-people.service';
import { ToastService } from '../../../core/services/toast.service';
import { resolveMediaImageUrl } from '../../../core/constants/api.constants';
import { CollectionQueryContext } from '../../../core/services/collection-loader.service';
import { TmdbPersonCombinedCreditsResponseDto } from '../../../core/dtos/people/person-combined-credits.dto';

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
    private peopleService = inject(TmdbPeopleService);
    private toastService = inject(ToastService);
    private router = inject(Router);

    public title = input.required<string>();
    public items = input.required<SwimlaneItem[]>();
    public queryContext = input<CollectionQueryContext>();

    constructor() {
        addIcons({ chevronForwardOutline, heart, heartOutline });
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
        if (query?.region) queryParams['region'] = query.region;
        if (query?.movieParams) queryParams['movieParams'] = JSON.stringify(query.movieParams);
        if (query?.tvParams) queryParams['tvParams'] = JSON.stringify(query.tvParams);

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

    public getNumericTmdbId(item: SwimlaneItem): number | undefined {
        const num = Number(item.id);
        return Number.isFinite(num) && num > 0 ? num : undefined;
    }

    public getMediaType(item: SwimlaneItem): 'movie' | 'tv' | undefined {
        return item.mediaType === 'movie' || item.mediaType === 'tv' ? item.mediaType : undefined;
    }

    public isPersonFavorite(item: SwimlaneItem): boolean {
        if (item.mediaType !== 'person') return false;
        const id = Number(item.id);
        return Number.isFinite(id) && id > 0 ? this.storageService.isPersonFavorite(id) : false;
    }

    public getPersonDepartmentLabel(item: SwimlaneItem): string {
        if (item.mediaType !== 'person') return '';
        const rawDept = String(item.payload?.['known_for_department'] || '').trim();
        if (/directing/i.test(rawDept)) return 'DIRECTOR';
        if (/writing/i.test(rawDept)) return 'WRITER';
        if (/production/i.test(rawDept)) return 'PRODUCER';
        return 'ACTOR';
    }

    public async onTogglePersonFavorite(event: Event, item: SwimlaneItem): Promise<void> {
        event.stopPropagation();
        if (item.mediaType !== 'person') return;
        const personId = Number(item.id);
        if (!Number.isFinite(personId) || personId <= 0) return;

        const rawProfilePath = (item.payload?.['profile_path'] as string | null | undefined) ?? item.posterUrl ?? null;
        const rawDept = String(item.payload?.['known_for_department'] || 'Acting');
        const isNowFav = await this.storageService.toggleFavoritePerson({
            id: personId,
            name: item.title,
            profilePath: rawProfilePath,
            department: rawDept,
            knownForTitles: item.subtitle || ''
        });

        if (isNowFav) {
            await this.toastService.presentSuccess(`Added ${item.title} to Favorite Artists`, 1800);
            void this.hydrateFavoritePersonInBackground(personId);
        } else {
            await this.toastService.presentWarning(`Removed ${item.title} from Favorite Artists`, 1800);
        }
    }

    private async hydrateFavoritePersonInBackground(personId: number): Promise<void> {
        try {
            const details = await firstValueFrom(
                this.peopleService.getPersonDetails(personId, 'combined_credits')
            );
            if (!this.storageService.isPersonFavorite(personId)) return;
            const combined = (details?.['combined_credits'] as TmdbPersonCombinedCreditsResponseDto | undefined) ?? null;
            const extracted = extractPersonCreditMetadata(combined);
            if (extracted.creditIds.length > 0) {
                await this.storageService.updateFavoritePersonCredits(personId, extracted.creditIds, {
                    topCredits: extracted.topCredits,
                    knownForTitles: extracted.knownForTitles,
                    department: details.known_for_department || undefined,
                    profilePath: details.profile_path
                });
            }
        } catch (err) {
            console.warn('[SwimlaneComponent] Background person credit hydration failed:', err);
        }
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

        const prevState = this.storageService.getBookmarkState(Number(item.id), mediaType);
        const nextState = await this.storageService.cycleBookmark(Number(item.id), mediaType, payload);
        if (nextState === 'watchlist') {
            await this.toastService.presentSuccess(`Added "${item.title}" to Watchlist`, 1800);
        } else if (nextState === 'watched') {
            await this.toastService.presentInfo(`Marked "${item.title}" as Watched`, 1800);
        } else if (prevState === 'watchlist') {
            await this.toastService.presentWarning(`Removed "${item.title}" from Watchlist (not released yet — cannot mark Watched)`, 2200);
        } else {
            await this.toastService.presentWarning(`Removed "${item.title}" from Archive`, 1800);
        }
    }
}
