import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavController } from '@ionic/angular';
import {
    IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle,
    IonContent, IonList, IonListHeader, IonLabel, IonItem, IonNote,
    IonToggle, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    arrowBackOutline, contrastOutline, shieldCheckmarkOutline,
    trashOutline, cloudDownloadOutline, cloudUploadOutline,
    logoGithub, mailOutline, informationCircleOutline
} from 'ionicons/icons';
import { StorageService } from 'src/app/core/services/storage.service';
import { ApiCacheService } from 'src/app/core/services/api-cache.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { SearchStore } from 'src/app/core/store/search.store';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [
        CommonModule, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon,
        IonTitle, IonContent, IonList, IonListHeader, IonLabel, IonItem, IonNote,
        IonToggle
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
    private navCtrl = inject(NavController);
    public storage = inject(StorageService);
    private apiCache = inject(ApiCacheService);
    private toast = inject(ToastService);
    private alertCtrl = inject(AlertController);
    private searchStore = inject(SearchStore);

    public appVersion = signal<string>('4.0.0');

    constructor() {
        addIcons({
            arrowBackOutline, contrastOutline, shieldCheckmarkOutline,
            trashOutline, cloudDownloadOutline, cloudUploadOutline,
            logoGithub, mailOutline, informationCircleOutline
        });
    }

    async ngOnInit(): Promise<void> {
        await this.storage.getSettings();
    }

    // --- NAVIGATION ---
    public goBack(): void {
        this.navCtrl.back();
    }

    // --- PREFERENCES ---
    public async onToggleAdultContent(event: CustomEvent): Promise<void> {
        const allowAdultContent = Boolean(event.detail?.checked);
        await this.storage.updateSettings({ allowAdultContent });
        await this.toast.presentInfo(
            allowAdultContent ? 'Adult content filter disabled' : 'Family-safe filter enabled',
            2000
        );
    }

    // --- DATA MANAGEMENT ---
    public async confirmClearWatchlist(): Promise<void> {
        const alert = await this.alertCtrl.create({
            header: 'Clear Watchlist?',
            message: 'This will remove all titles currently saved in your Watchlist.',
            buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                    text: 'Clear',
                    role: 'destructive',
                    handler: async (): Promise<void> => {
                        const count = await this.storage.clearWatchlist();
                        await this.toast.presentSuccess(`Cleared ${count} item(s) from Watchlist`);
                    }
                }
            ]
        });
        await alert.present();
    }

    public async confirmClearWatchedList(): Promise<void> {
        const alert = await this.alertCtrl.create({
            header: 'Clear Watched History?',
            message: 'This will remove all titles marked as Watched.',
            buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                    text: 'Clear',
                    role: 'destructive',
                    handler: async (): Promise<void> => {
                        const count = await this.storage.clearWatchedList();
                        await this.toast.presentSuccess(`Cleared ${count} item(s) from Watched List`);
                    }
                }
            ]
        });
        await alert.present();
    }

    public async confirmClearCache(): Promise<void> {
        const clearedResponses = this.apiCache.clearAll();
        await this.searchStore.clearRecentSearches();
        await this.toast.presentSuccess(
            `Cleared search history & ${clearedResponses} cached API response(s)`
        );
    }

    public async createBackup(): Promise<void> {
        try {
            const json = await this.storage.exportBackupJson();
            const fileName = `cinescope-backup-${new Date().toISOString().slice(0, 10)}.json`;
            const blob = new Blob([json], { type: 'application/json' });

            // Support native mobile share sheet if available (great for Family & Friends WhatsApp/Drive backup)
            const file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Cinescope Backup',
                    text: 'My Cinescope Watchlist & Watched Backup',
                    files: [file]
                });
                await this.toast.presentSuccess('Backup shared successfully!');
                return;
            }

            // Fallback download
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            anchor.click();
            URL.revokeObjectURL(url);
            await this.toast.presentSuccess(`Saved ${fileName}`);
        } catch (err) {
            console.error('Backup failed', err);
            await this.toast.presentError('Failed to create backup');
        }
    }

    public triggerRestoreBackup(fileInput: HTMLInputElement): void {
        fileInput.value = '';
        fileInput.click();
    }

    public async onBackupFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) return;

        try {
            const rawJson = await this.readFileAsText(file);
            const { watchlistCount, watchedCount, contentCount, historyCount } =
                await this.storage.importBackupJson(rawJson.trim());
            await this.searchStore.loadRecentSearches();

            if (watchlistCount > 0 || watchedCount > 0) {
                await this.toast.presentSuccess(
                    `Restored ${watchlistCount} Watchlist & ${watchedCount} Watched title(s)!`,
                    3500
                );
            } else {
                await this.toast.presentSuccess(
                    `Restored ${contentCount} library title(s) & ${historyCount} search(es)!`,
                    3000
                );
            }
        } catch (err) {
            console.error('Restore failed', err);
            await this.toast.presentError('Invalid or corrupted backup JSON file');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    private readFileAsText(file: File): Promise<string> {
        if (typeof file.text === 'function') {
            return file.text();
        }
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (): void => resolve(String(reader.result ?? ''));
            reader.onerror = (): void => reject(reader.error ?? new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // --- SUPPORT ---
    public openUrl(url: string): void {
        window.open(url, '_blank');
    }

    public sendFeedback(): void {
        window.open('mailto:support@cinescope.com?subject=Cinescope Feedback', '_system');
    }
}