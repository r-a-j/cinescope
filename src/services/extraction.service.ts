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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ExtractionService {
    private imageQueue: { uri: string }[] = [];
    private isProcessingQueue = false;
    private isCoolingDown = false;
    private readonly BATCH_SIZE = 5;
    private readonly GEMINI_BATCH_SIZE = 20;
    private readonly RATE_LIMIT_RETRY_MS = 5 * 60 * 1000;
    public extractionState$ = new BehaviorSubject<{ isExtracting: boolean; text: string }>({ isExtracting: false, text: '' });

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
                try {
                    await App.minimizeApp();

                    if (event.files && event.files.length > 0) {
                        const imageFiles = event.files.filter(f => f.mimeType && f.mimeType.startsWith('image/'));

                        if (imageFiles.length === 0) {
                            await this.sendFinalNotification(0, 'Received unsupported file types. Only images are supported.');
                            return;
                        }

                        this.imageQueue.push(...imageFiles.map(f => ({ uri: f.uri })));

                        await LocalNotifications.schedule({
                            notifications: [{
                                id: 999,
                                title: 'CineScope AI',
                                body: `Queued ${imageFiles.length} image(s). Processing in background...`,
                                smallIcon: 'ic_stat_icon_config_sample'
                            }]
                        });

                        this.processQueue();
                    } else {
                        await this.sendFinalNotification(0, 'Unsupported share format received.');
                    }
                } catch (error) {
                    console.error('[Extraction] Shared item processing failed', error);
                    await this.sendFinalNotification(0, 'An error occurred during extraction.');
                }
            });
        });
    }

    private async processQueue() {
        if (this.isProcessingQueue || this.imageQueue.length === 0 || this.isCoolingDown) {
            return;
        }

        this.isProcessingQueue = true;

        let processedImagesCount = 0;
        const totalImagesInQueue = this.imageQueue.length;

        try {
            while (this.imageQueue.length > 0) {
                const geminiBatch = this.imageQueue.splice(0, this.GEMINI_BATCH_SIZE);
                let massiveTextPile = '';

                for (let i = 0; i < geminiBatch.length; i += this.BATCH_SIZE) {
                    const ocrBatch = geminiBatch.slice(i, i + this.BATCH_SIZE);

                    for (const file of ocrBatch) {
                        processedImagesCount++;

                        this.extractionState$.next({
                            isExtracting: true,
                            text: `Processing image ${processedImagesCount} of ${totalImagesInQueue}...`
                        });

                        const text = await this.performLocalOCR(file.uri);
                        if (text && text.trim()) {
                            massiveTextPile += text + '\n\n---NEXT SCREENSHOT---\n\n';
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (!massiveTextPile.trim()) {
                    console.warn('[Extraction] Failed to extract text from batch. Skipping.');
                    this.extractionState$.next({ isExtracting: true, text: `No text found in batch. Continuing...` });
                    continue;
                }

                try {
                    this.extractionState$.next({
                        isExtracting: true,
                        text: `Analyzing extracted text for batch of ${geminiBatch.length}...`
                    });

                    const extractedTitles = await this.extractViaGeminiBatch(massiveTextPile);

                    if (extractedTitles && extractedTitles.length > 0) {
                        await this.resolveAndSaveBatch(extractedTitles);
                    } else {
                        console.log('[Extraction] No recognizable movies or TV shows found in this batch.');
                    }
                } catch (error: any) {
                    const isRateLimit = error instanceof HttpErrorResponse && error.status === 429;
                    if (isRateLimit) {
                        console.warn('[Extraction] Rate limit hit. Pausing queue.');

                        await LocalNotifications.schedule({
                            notifications: [{
                                id: 999,
                                title: 'CineScope AI',
                                body: `API Limit reached. Pausing for 5 minutes...`,
                                smallIcon: 'ic_stat_icon_config_sample'
                            }]
                        });

                        this.imageQueue.unshift(...geminiBatch);
                        this.isCoolingDown = true;
                        this.isProcessingQueue = false;

                        this.extractionState$.next({
                            isExtracting: true,
                            text: `API Rate Limit hit. Pausing for 5 minutes...`
                        });

                        setTimeout(() => {
                            console.log('[Extraction] Resuming queue after rate limit cooldown.');
                            this.isCoolingDown = false;
                            this.processQueue();
                        }, this.RATE_LIMIT_RETRY_MS);

                        return;
                    } else {
                        console.error('[Extraction] Gemini extraction failed for batch', error);
                    }
                }
            }

            if (this.imageQueue.length === 0) {
                this.extractionState$.next({ isExtracting: false, text: '' });
                await LocalNotifications.cancel({ notifications: [{ id: 999 }] });
            }

        } catch (error) {
            console.error('[Extraction] Fatal error processing queue', error);
            this.extractionState$.next({ isExtracting: false, text: '' });
            await this.sendFinalNotification(0, 'An error occurred while processing the image queue.');
        } finally {
            this.isProcessingQueue = false;
        }
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
        const response = await firstValueFrom(
            this.http.post<string[]>(`${environment.apiUrl}/extract`, { text: massiveText })
        );

        return response || [];
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
                            isWatched: false,
                            addedAt: new Date().toISOString()
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