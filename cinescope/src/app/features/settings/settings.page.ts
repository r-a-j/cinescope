import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { NavController } from '@ionic/angular';
import {
    IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle,
    IonContent, IonList, IonListHeader, IonLabel, IonItem, IonNote,
    AlertController, ActionSheetController, IonModal, IonSpinner, IonToggle
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    arrowBackOutline, contrastOutline, shieldCheckmarkOutline,
    trashOutline, cloudDownloadOutline, cloudUploadOutline,
    logoGithub, mailOutline, informationCircleOutline,
    downloadOutline, shareSocialOutline, closeOutline,
    folderOutline, chevronForwardOutline, chevronDownOutline, globeOutline,
    locateOutline, searchOutline, closeCircle, checkmarkCircle,
    sparklesOutline, albumsOutline, ticketOutline, filmOutline, timeOutline, refreshOutline, compassOutline,
    helpCircleOutline
} from 'ionicons/icons';
import { StorageService } from 'src/app/core/services/storage.service';
import { RegionService } from 'src/app/core/services/region.service';
import { ApiCacheService } from 'src/app/core/services/api-cache.service';
import { PosterCacheService } from 'src/app/core/services/poster-cache.service';
import { TmdbWatchProvidersService } from 'src/app/core/services/tmdb-watch-providers.service';
import { TmdbWatchRegionDto } from 'src/app/core/dtos/watch-providers/watch-provider.dto';
import { firstValueFrom } from 'rxjs';
import { ToastService } from 'src/app/core/services/toast.service';
import { SearchStore } from 'src/app/core/store/search.store';
import { MoviesPreferencesService } from 'src/app/core/services/movies-preferences.service';
import { AppTourService } from 'src/app/core/services/app-tour.service';
import { APP_TOUR_CATEGORIES, AppTourId } from 'src/app/core/constants/app-tour.constants';
import { APP_VERSION } from 'src/app/core/constants/app-version';

interface NativeBackupPlugin {
    saveToDownloads(options: { filename: string; content: string }): Promise<{ success: boolean; filePath: string }>;
    shareFile(options: { filename: string; content: string; title: string }): Promise<{ success: boolean }>;
}

const NativeBackup = registerPlugin<NativeBackupPlugin>('NativeBackup');

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [
        CommonModule, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon,
        IonTitle, IonContent, IonList, IonListHeader, IonLabel, IonItem, IonNote,
        IonModal, IonSpinner, IonToggle
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
    private navCtrl = inject(NavController);
    public storage = inject(StorageService);
    public moviesPrefs = inject(MoviesPreferencesService);
    public isMoviesTabCollapsed = signal<boolean>(true);
    public isHelpTutorialsCollapsed = signal<boolean>(true);
    public expandedTutorialCategories = signal<Set<string>>(new Set());
    private apiCache = inject(ApiCacheService);
    private posterCache = inject(PosterCacheService);
    private toast = inject(ToastService);
    private alertCtrl = inject(AlertController);
    private actionSheetCtrl = inject(ActionSheetController);
    private searchStore = inject(SearchStore);
    private watchProvidersService = inject(TmdbWatchProvidersService);
    private appTour = inject(AppTourService);
    public regionService = inject(RegionService);
    public tutorialCategories = APP_TOUR_CATEGORIES;

    public appVersion = signal<string>(APP_VERSION);
    // Region selector state
    public isRegionModalOpen = signal<boolean>(false);
    public availableRegions = signal<TmdbWatchRegionDto[]>([]);
    public regionSearchQuery = signal<string>('');
    public isLoadingRegions = signal<boolean>(false);
    public isDetectingRegion = signal<boolean>(false);

    public filteredRegions = computed<TmdbWatchRegionDto[]>(() => {
        const query = this.regionSearchQuery().toLowerCase().trim();
        const list = this.availableRegions();
        if (!query) return list;
        return list.filter(r =>
            r.english_name.toLowerCase().includes(query) ||
            r.iso_3166_1.toLowerCase().includes(query) ||
            (r.native_name && r.native_name.toLowerCase().includes(query))
        );
    });

    public currentRegionName = computed<string>(() => {
        const code = this.storage.userRegion();
        const match = this.availableRegions().find(r => r.iso_3166_1 === code);
        if (match) return match.english_name;
        return this.regionService.resolveCountryName(code);
    });
    public isBackupModalOpen = signal<boolean>(false);
    public isExporting = signal<boolean>(false);
    public exportingAction = signal<'downloads' | 'share' | null>(null);

    public backupFileName = computed<string>(() => {
        const dateStr = new Date().toISOString().slice(0, 10);
        return `cinescope-backup-${dateStr}.json`;
    });

    public async startTutorial(id: AppTourId): Promise<void> {
        try {
            await this.appTour.start(id);
        } catch (error) {
            console.error('[SettingsPage] Could not start tutorial:', error);
            await this.toast.presentError('Could not open this tutorial. Please try again.');
        }
    }

    public isTutorialCategoryExpanded(id: string): boolean {
        return this.expandedTutorialCategories().has(id);
    }

    public toggleTutorialCategory(id: string): void {
        this.expandedTutorialCategories.update(expanded => {
            const next = new Set(expanded);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    constructor() {
        addIcons({
            arrowBackOutline, contrastOutline, shieldCheckmarkOutline,
            trashOutline, cloudDownloadOutline, cloudUploadOutline,
            logoGithub, mailOutline, informationCircleOutline,
            downloadOutline, shareSocialOutline, closeOutline,
            folderOutline, chevronForwardOutline, chevronDownOutline, globeOutline,
    locateOutline, searchOutline, closeCircle, checkmarkCircle,
            sparklesOutline, albumsOutline, ticketOutline, filmOutline, timeOutline, refreshOutline, compassOutline,
            helpCircleOutline
        });
    }

    // --- REGION MANAGEMENT ---
    public async openRegionModal(): Promise<void> {
        this.isRegionModalOpen.set(true);
        this.regionSearchQuery.set('');
        if (this.availableRegions().length === 0) {
            // Immediate pre-population from static fallback for instant offline responsiveness
            this.availableRegions.set(this.regionService.getStaticFallbackRegions());
            this.isLoadingRegions.set(true);
            try {
                const res = await firstValueFrom(this.watchProvidersService.getAvailableRegions());
                if (res?.results && Array.isArray(res.results)) {
                    const sorted = [...res.results].sort((a, b) => a.english_name.localeCompare(b.english_name));
                    this.availableRegions.set(sorted);
                }
            } catch (err) {
                console.warn('[SettingsPage] Using static fallback regions for TMDB watch providers', err);
            } finally {
                this.isLoadingRegions.set(false);
            }
        }
    }

    public closeRegionModal(): void {
        this.isRegionModalOpen.set(false);
        this.regionSearchQuery.set('');
    }

    public onRegionSearch(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.regionSearchQuery.set(input?.value || '');
    }

    public clearRegionSearch(): void {
        this.regionSearchQuery.set('');
    }

    public async selectRegion(region: TmdbWatchRegionDto): Promise<void> {
        await this.storage.updateSettings({
            region: region.iso_3166_1,
            isManualRegion: true
        });
        await this.toast.presentSuccess(`Region updated to ${region.english_name} (${region.iso_3166_1})`, 2500);
        this.closeRegionModal();
    }

    public async autoDetectRegion(): Promise<void> {
        if (this.isDetectingRegion()) return;
        this.isDetectingRegion.set(true);
        try {
            const detectedCode = await this.storage.autoDetectAndApplyRegion();
            const name = this.regionService.resolveCountryName(detectedCode);
            await this.toast.presentSuccess(`Auto-detected region: ${name} (${detectedCode})`, 3000);
            this.closeRegionModal();
        } catch (err) {
            console.error('Auto-detection failed', err);
            await this.toast.presentError('Could not detect region. Defaulted to India (IN).');
        } finally {
            this.isDetectingRegion.set(false);
        }
    }

    public getCountryFlagUrl(countryCode: string | null | undefined): string {
        if (!countryCode || countryCode.length !== 2) return '';
        return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
    }

    public onFlagError(event: Event): void {
        const img = event.target as HTMLImageElement;
        if (img) {
            img.style.display = 'none';
        }
    }

    async ngOnInit(): Promise<void> {
        await this.storage.getSettings();
        try {
            const info = await App.getInfo();
            if (info?.version) {
                this.appVersion.set(info.version);
            }
        } catch {
            this.appVersion.set(APP_VERSION);
        }
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
        await Promise.all([
            this.posterCache.clearCache(),
            this.searchStore.clearRecentSearches()
        ]);
        await this.toast.presentSuccess(
            `Cleared search history, poster cache & ${clearedResponses} API cache(s)`
        );
    }

        private downloadWebFile(blob: Blob, fileName: string): void {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    public openBackupModal(): void {
        this.isBackupModalOpen.set(true);
    }

    public closeBackupModal(): void {
        if (this.isExporting()) return;
        this.isBackupModalOpen.set(false);
        this.exportingAction.set(null);
    }

    public createBackup(): void {
        this.openBackupModal();
    }

    public async executeSaveToDownloads(): Promise<void> {
        if (this.isExporting()) return;
        this.isExporting.set(true);
        this.exportingAction.set('downloads');
        const fileName = this.backupFileName();

        try {
            const json = await this.storage.exportBackupJson();

            if (Capacitor.isNativePlatform()) {
                const result = await NativeBackup.saveToDownloads({
                    filename: fileName,
                    content: json
                });
                await this.toast.presentSuccess(`Saved to ${result.filePath}!`, 3500);
                this.closeBackupModal();
                return;
            }

            // Web browser download
            const blob = new Blob([json], { type: 'application/json' });
            this.downloadWebFile(blob, fileName);
            await this.toast.presentSuccess(`Saved ${fileName}!`, 3000);
            this.closeBackupModal();
        } catch (err) {
            console.error('Save to downloads failed', err);
            await this.toast.presentError('Could not save to Downloads folder.');
        } finally {
            this.isExporting.set(false);
            this.exportingAction.set(null);
        }
    }

    public async executeShareFile(): Promise<void> {
        if (this.isExporting()) return;
        this.isExporting.set(true);
        this.exportingAction.set('share');
        const fileName = this.backupFileName();

        try {
            const json = await this.storage.exportBackupJson();

            if (Capacitor.isNativePlatform()) {
                await NativeBackup.shareFile({
                    filename: fileName,
                    content: json,
                    title: 'CineScope Library Backup'
                });
                this.closeBackupModal();
                return;
            }

            // Web share
            const blob = new Blob([json], { type: 'application/json' });
            const file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        title: 'CineScope Backup',
                        text: 'My CineScope Collection Backup',
                        files: [file]
                    });
                    await this.toast.presentSuccess('Backup shared successfully!');
                    this.closeBackupModal();
                    return;
                } catch (shareErr) {
                    if (shareErr instanceof Error && shareErr.name === 'AbortError') {
                        return;
                    }
                    console.warn('Web share failed, falling back to download:', shareErr);
                }
            }

            // Fallback download
            this.downloadWebFile(blob, fileName);
            await this.toast.presentSuccess(`Saved ${fileName}!`, 3000);
            this.closeBackupModal();
        } catch (err) {
            console.error('Share backup failed', err);
            await this.toast.presentError('Could not open share sheet.');
        } finally {
            this.isExporting.set(false);
            this.exportingAction.set(null);
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
            const cleanJson = rawJson.replace(/^\uFEFF/, '').trim();
            const inspection = this.storage.inspectBackupJson(cleanJson);

            if (!inspection.isValid) {
                await this.toast.presentError(
                    inspection.error || 'The selected file is not a valid CineScope backup.'
                );
                return;
            }

            // Format inspection summary
            const formatLabel = inspection.format === 'legacy' ? 'Legacy CineScope v1' : `CineScope v${inspection.appVersion || '1.x'}`;
            const dateLabel = inspection.exportedAt ? ` from ${inspection.exportedAt.slice(0, 10)}` : '';

            const details: string[] = [];
            if (inspection.watchlistCount > 0) details.push(`• Watchlist: ${inspection.watchlistCount} title(s)`);
            if (inspection.watchedCount > 0) details.push(`• Watched: ${inspection.watchedCount} title(s)`);
            if (inspection.inboxCount > 0) details.push(`• Inbox Queue: ${inspection.inboxCount} title(s)`);
            if (inspection.favoritePeopleCount > 0) details.push(`• Favorite People: ${inspection.favoritePeopleCount}`);
            if (inspection.historyCount > 0) details.push(`• Search History: ${inspection.historyCount} queries`);
            if (inspection.hasSettings) details.push('• Preferences & Settings');

            const alert = await this.alertCtrl.create({
                header: 'Restore Library Backup?',
                subHeader: `${formatLabel}${dateLabel} (${inspection.totalTitles} items)`,
                message: `This backup contains:\n\n${details.join('\n')}\n\nExisting items with matching IDs will be safely merged and updated into your library. Do you want to proceed?`,
                buttons: [
                    {
                        text: 'Cancel',
                        role: 'cancel'
                    },
                    {
                        text: 'Restore Library',
                        handler: async (): Promise<void> => {
                            try {
                                const result = await this.storage.importBackupJson(cleanJson);
                                await Promise.all([
                                    this.storage.getSettings(),
                                    this.searchStore.loadRecentSearches()
                                ]);

                                const summary: string[] = [];
                                if (result.watchlistCount > 0) summary.push(`${result.watchlistCount} Watchlist`);
                                if (result.watchedCount > 0) summary.push(`${result.watchedCount} Watched`);
                                if (result.inboxCount > 0) summary.push(`${result.inboxCount} Inbox`);

                                const restoredText = summary.length > 0 ? summary.join(', ') : `${result.contentCount} titles`;
                                await this.toast.presentSuccess(`Successfully restored ${restoredText}!`, 3500);
                            } catch (importErr) {
                                console.error('Restore commit failed', importErr);
                                await this.toast.presentError('Failed to restore backup data.');
                            }
                        }
                    }
                ]
            });

            await alert.present();
        } catch (err) {
            console.error('Restore preview failed', err);
            await this.toast.presentError('Invalid or unreadable backup file.');
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
        window.open('mailto:enggcoding@gmail.com?subject=Cinescope Feedback', '_system');
    }
}