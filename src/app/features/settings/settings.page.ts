import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavController } from '@ionic/angular';
import {
    IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle,
    IonContent, IonList, IonListHeader, IonLabel, IonItem, IonNote
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    arrowBackOutline, contrastOutline, shieldCheckmarkOutline,
    trashOutline, cloudDownloadOutline, cloudUploadOutline,
    logoGithub, mailOutline, informationCircleOutline
} from 'ionicons/icons';
import { StorageService } from 'src/app/core/services/storage.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [
        CommonModule, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon,
        IonTitle, IonContent, IonList, IonListHeader, IonLabel, IonItem, IonNote
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {
    private navCtrl = inject(NavController);
    private storage = inject(StorageService);

    public appVersion = signal<string>('4.0.0'); // Example version

    constructor() {
        // Strictly register only the icons used on this page
        addIcons({
            arrowBackOutline, contrastOutline, shieldCheckmarkOutline,
            trashOutline, cloudDownloadOutline, cloudUploadOutline,
            logoGithub, mailOutline, informationCircleOutline
        });
    }

    async ngOnInit(): Promise<void> {
        const settings = await this.storage.getSettings();
        if (settings) {
            console.log(settings);
        }
    }

    // --- NAVIGATION ---
    public goBack(): void {
        this.navCtrl.back();
    }

    // --- DATA MANAGEMENT ---
    public confirmClearWatchlist(): void {
        console.log('Action: Clear Watchlist');
    }

    public confirmClearWatchedList(): void {
        console.log('Action: Clear Watched List');
    }

    public confirmClearCache(): void {
        console.log('Action: Clear Cache');
    }

    public createBackup(): void {
        console.log('Action: Create Backup');
    }

    public restoreBackup(): void {
        console.log('Action: Restore Backup');
    }

    // --- SUPPORT ---
    public openUrl(url: string): void {
        window.open(url, '_blank');
    }

    public sendFeedback(): void {
        // Standard mailto link
        window.open('mailto:support@cinescope.com?subject=Cinescope Feedback', '_system');
    }
}