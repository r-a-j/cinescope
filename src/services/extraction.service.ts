import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { CapacitorShareTarget } from '@capgo/capacitor-share-target';
import { Ocr, TextDetections } from '@capacitor-community/image-to-text';
import { Filesystem } from '@capacitor/filesystem';
import { environment } from '../environments/environment';
import { TmdbSearchService } from './tmdb-search.service';
import { firstValueFrom } from 'rxjs';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { StorageService } from './storage.service';
import { ContentModel } from 'src/models/content.model';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class ExtractionService {

    constructor(
        private ngZone: NgZone,
        private tmdbService: TmdbSearchService,
        private storageService: StorageService,
        private router: Router,
        private http: HttpClient
    ) { }

    initNotificationTapListener() {
        LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
            this.ngZone.run(() => {
                if (notificationAction.notification.id === 1000 && notificationAction.actionId === 'tap') {
                    console.log('[Router] User tapped notification. Navigating to Inbox...');
                    LocalNotifications.cancel({ notifications: [{ id: 1000 }] });
                    this.router.navigate(['/tabs/inbox']);
                }
            });
        });
    }

    initShareListener() {
        CapacitorShareTarget.addListener('shareReceived', (event) => {
            this.ngZone.run(async () => {
                if (event.files && event.files.length > 0) {
                    await App.minimizeApp();

                    await LocalNotifications.schedule({
                        notifications: [{
                            id: 999,
                            title: 'CineScope AI',
                            body: `Received ${event.files.length} image(s). Processing... will notify shortly.`,
                            smallIcon: 'ic_stat_icon_config_sample'
                        }]
                    });

                    let massiveTextPile = '';
                    for (const file of event.files) {
                        const text = await this.performLocalOCR(file.uri);
                        massiveTextPile += text + '\n\n---NEXT SCREENSHOT---\n\n';
                    }

                    const extractedTitles = await this.extractViaGeminiBatch(massiveTextPile);

                    if (extractedTitles.length > 0) {
                        await this.resolveAndSaveBatch(extractedTitles);
                    } else {
                        await this.sendFinalNotification(0, 'No movies found in those images.');
                    }
                }
            });
        });
    }

    private async performLocalOCR(imageUri: string): Promise<string> {
        try {
            const file = await Filesystem.readFile({ path: imageUri });
            const data: TextDetections = await Ocr.detectText({ base64: file.data as string });
            return data.textDetections.map(d => d.text).join(' ');
        } catch (error) {
            console.error('[Extraction] OCR Failed:', error);
            return '';
        }
    }

    private async extractViaGeminiBatch(massiveText: string): Promise<string[]> {
        try {
            const response = await firstValueFrom(
                this.http.post<string[]>(`${environment.apiUrl}/extract`, { text: massiveText })
            );

            return response || [];
        } catch (error) {
            console.warn('[AI] Proxy extraction failed or rate limited:', error);
            return [];
        }
    }

    private async resolveAndSaveBatch(titles: string[]) {
        const watchlist = await this.storageService.getWatchlist();
        const watched = await this.storageService.getWatched();
        const newInboxItems: ContentModel[] = [];

        for (const title of titles) {
            try {
                const response: any = await firstValueFrom(this.tmdbService.searchMovies(title, 1));

                if (response.results && response.results.length > 0) {
                    const topHit = response.results[0];

                    const isAlreadySaved =
                        watchlist.some(m => m.contentId === topHit.id) ||
                        watched.some(m => m.contentId === topHit.id);

                    if (!isAlreadySaved) {
                        newInboxItems.push({
                            contentId: topHit.id,
                            isMovie: true,
                            isTv: false,
                            title: topHit.title,
                            poster_path: topHit.poster_path,
                            release_date: topHit.release_date,
                            vote_average: topHit.vote_average,
                            genres: topHit.genre_ids || topHit.genres,
                            isWatchlist: false,
                            isWatched: false
                        } as ContentModel);
                    }
                }
            } catch (err) {
                console.error(`[TMDB] Search failed for "${title}"`);
            }
        }

        if (newInboxItems.length > 0) {
            await this.storageService.addToInbox(newInboxItems);
            const bodyTxt = newInboxItems.length === 1
                ? `🍿 Found 1 new movie. Tap to review.`
                : `🍿 Found all ${newInboxItems.length} movies. Tap to review.`;

            await this.sendFinalNotification(newInboxItems.length, bodyTxt);
        } else {
            await this.sendFinalNotification(0, 'Movies found were already in your lists!');
        }
    }

    private async sendFinalNotification(count: number, bodyText: string) {
        await LocalNotifications.cancel({ notifications: [{ id: 999 }] });

        await LocalNotifications.schedule({
            notifications: [
                {
                    id: 1000,
                    title: 'CineScope Inbox',
                    body: bodyText,
                    smallIcon: 'ic_stat_icon_config_sample',
                    extra: { hasNewItems: count > 0 }
                }
            ]
        });
    }
}