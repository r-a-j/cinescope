import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonButton, IonItem, IonLabel, IonNote, IonToggle,
  IonToolbar, IonButtons, IonIcon, IonHeader, IonTitle, IonList,
  IonListHeader, IonSelect, IonSelectOption, LoadingController, AlertController
} from '@ionic/angular/standalone';
import { Toast } from '@capacitor/toast';
import { Dialog } from '@capacitor/dialog';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, moonOutline, sunnyOutline, contrastOutline, trashOutline,
  cloudDownloadOutline, cloudUploadOutline, logoGithub, mailOutline,
  informationCircleOutline, shieldCheckmarkOutline, documentTextOutline,
  openOutline, warningOutline, checkmarkCircleOutline, closeCircleOutline
} from 'ionicons/icons';
import { StorageService } from 'src/services/storage.service';
import { SettingModel } from 'src/models/setting.model';
import { Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Browser } from '@capacitor/browser';
import { App, AppInfo } from '@capacitor/app';

@Component({
  selector: 'app-setting',
  templateUrl: './setting.page.html',
  styleUrls: ['./setting.page.scss'],
  standalone: true,
  imports: [
    IonTitle, IonHeader, IonIcon, IonButtons, IonToolbar, IonToggle,
    IonNote, IonLabel, IonItem, IonButton, IonContent, CommonModule,
    FormsModule, IonList, IonListHeader, IonSelect, IonSelectOption
  ],
})
export class SettingPage implements OnInit {
  allowAdultContent: boolean = false;
  theme: 'system' | 'light' | 'dark' = 'system';
  appVersion: string = '';

  constructor(
    private router: Router,
    private storageService: StorageService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController) {
    addIcons({
      arrowBackOutline, moonOutline, sunnyOutline, contrastOutline, trashOutline,
      cloudDownloadOutline, cloudUploadOutline, logoGithub, mailOutline,
      informationCircleOutline, shieldCheckmarkOutline, documentTextOutline,
      openOutline, warningOutline, checkmarkCircleOutline, closeCircleOutline
    });
  }

  ngOnInit() {
    this.storageService.getSettings().then((settings: SettingModel | null) => {
      if (settings) {
        this.allowAdultContent = settings.allowAdultContent || false;
        this.theme = settings.theme || 'system';
      }
    });

    this.loadAppVersion();
  }

  async loadAppVersion() {
    try {
      const info: AppInfo = await App.getInfo();
      this.appVersion = info.version;
    } catch (e) {
      console.warn('Could not load app version', e);
      this.appVersion = '3.2.0'; // Fallback
    }
  }

  async saveCurrentSettings(): Promise<void> {
    const content: SettingModel = {
      allowAdultContent: this.allowAdultContent,
      theme: this.theme
    };
    await this.storageService.saveSettings(content as any);
  }

  async onThemeChange(event: any) {
    this.theme = event.detail.value;
    await this.saveCurrentSettings();
  }

  async createBackup(): Promise<void> {
    const loader = await this.loadingCtrl.create({
      message: 'Generating backup file...',
      spinner: 'crescent'
    });
    await loader.present();

    try {
      const { fileName } = await this.storageService.exportBackupAndShare();
      await loader.dismiss();
      await this.showToast(`Backup created: ${fileName}`, 'short', 'bottom');
    } catch (err: any) {
      await loader.dismiss();

      if (err?.message === 'Share canceled' || err?.message?.includes('canceled')) {
        console.log('User canceled the share dialog.');
      } else {
        console.error('[Backup Error]', err);
        await this.showToast('Backup failed', 'long', 'bottom');
      }
    }
  }

  async restoreBackup(): Promise<void> {
    try {
      const result = await FilePicker.pickFiles({ types: ['application/json'], limit: 1, readData: true });
      if (!result.files?.length) return;

      const f = result.files[0];
      let jsonText = '';

      if (f.data) {
        jsonText = atob(f.data);
      } else if (f.path) {
        const r = await Filesystem.readFile({ path: f.path });
        jsonText = typeof r.data === 'string' ? r.data : await r.data.text();
      } else if (f.blob) {
        jsonText = await (f.blob as Blob).text();
      } else throw new Error('No file data');

      const alert = await this.alertCtrl.create({
        header: 'Restore Backup',
        message: 'How would you like to restore your data?',
        cssClass: 'custom-alert',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Merge (Keep Existing)', handler: () => this.processRestore(jsonText, 'merge') },
          { text: 'Replace (Overwrite)', role: 'destructive', handler: () => this.processRestore(jsonText, 'replace') }
        ]
      });
      await alert.present();

    } catch (err) {
      if ((err as any)?.message?.includes('User cancelled')) return;
      await this.showToast('Restore failed. Please try again.', 'long', 'bottom');
    }
  }

  async processRestore(jsonText: string, mode: 'merge' | 'replace') {
    const loader = await this.loadingCtrl.create({
      message: mode === 'merge' ? 'Merging your world...' : 'Restoring backup...',
      spinner: 'crescent',
      duration: 0,
      cssClass: 'custom-loader'
    });
    await loader.present();

    const progressSub = this.storageService.restoreProgress$.subscribe((msg) => loader.message = msg);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await this.storageService.restoreFromBackupJson(jsonText, mode);
      progressSub.unsubscribe();
      await loader.dismiss();
      await this.showToast(`Backup restored successfully! (${mode === 'merge' ? 'Merged' : 'Replaced'})`, 'short', 'bottom');
    } catch (error) {
      progressSub.unsubscribe();
      await loader.dismiss();
      await this.showToast('Error restoring data. File might be corrupt.', 'long', 'bottom');
    }
  }

  goHome(): void { this.router.navigate(['/tabs']); }

  async toggleAllowAdultContent(): Promise<void> {
    if (this.allowAdultContent) {
      const { value } = await Dialog.confirm({ title: 'Age Confirmation', message: 'Are you 18 or above?' });
      if (!value) {
        this.allowAdultContent = false;
        await this.showToast('Adult content disabled!', 'short', 'bottom');
      } else {
        this.allowAdultContent = true;
        await this.showToast('Adult content enabled!', 'short', 'bottom');
      }
    } else {
      this.allowAdultContent = false;
      await this.showToast('Adult content disabled!', 'short', 'bottom');
    }
    await this.saveCurrentSettings();
  }

  async confirmClearWatchlist(): Promise<void> {
    const { value } = await Dialog.confirm({ title: 'Confirm', message: 'Clear the watchlist? This action cannot be undone.' });
    if (value) await this.clearWatchlist();
  }

  async confirmClearWatchedList(): Promise<void> {
    const { value } = await Dialog.confirm({ title: 'Confirm', message: 'Clear the watched list? This action cannot be undone.' });
    if (value) await this.clearWatchedList();
  }

  async confirmClearCache(): Promise<void> {
    const { value } = await Dialog.confirm({ title: 'Clear Cache?', message: 'This will clear all cached data. It will NOT delete your lists.' });
    if (value) await this.showToast('Cache cleared', 'short', 'bottom');
  }

  async clearWatchlist(): Promise<void> {
    await Preferences.set({ key: 'watchlist_contents', value: JSON.stringify([]) });
    this.storageService.emitStorageChanged();
    await this.showToast('Watchlist cleared!', 'short', 'bottom');
  }

  async clearWatchedList(): Promise<void> {
    await Preferences.set({ key: 'watched_contents', value: JSON.stringify([]) });
    this.storageService.emitStorageChanged();
    await this.showToast('Watched list cleared!', 'short', 'bottom');
  }

  async showToast(message: string, duration: 'short' | 'long', position: 'top' | 'center' | 'bottom') {
    await Toast.show({ text: message, duration: duration, position: position });
  }

  async openUrl(url: string) { await Browser.open({ url }); }
  sendFeedback() { window.location.href = 'mailto:er.rajpawar@gmail.com?subject=Cinescope Feedback'; }
}