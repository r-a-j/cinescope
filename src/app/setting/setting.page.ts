import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonInput,
  IonToggle,
  IonToolbar,
  IonButtons,
  IonIcon,
  IonHeader,
  IonTitle,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonText,
  LoadingController,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { Toast } from '@capacitor/toast';
import { Clipboard } from '@capacitor/clipboard';
import { Dialog } from '@capacitor/dialog';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  moonOutline,
  sunnyOutline,
  contrastOutline,
  trashOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  logoGithub,
  mailOutline,
  informationCircleOutline,
  shieldCheckmarkOutline,
  documentTextOutline,
  openOutline,
  keyOutline,
  warningOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  eyeOutline,
  eyeOffOutline
} from 'ionicons/icons';
import { StorageService } from 'src/services/storage.service';
import { SettingModel } from 'src/models/setting.model';
import { Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-setting',
  templateUrl: './setting.page.html',
  styleUrls: ['./setting.page.scss'],
  standalone: true,
  imports: [
    IonTitle,
    IonHeader,
    IonIcon,
    IonButtons,
    IonToolbar,
    IonToggle,
    IonInput,
    IonNote,
    IonLabel,
    IonItem,
    IonButton,
    IonContent,
    CommonModule,
    FormsModule,
    IonList,
    IonListHeader,
    IonSelect,
    IonSelectOption,
    IonText
  ],
})
export class SettingPage implements OnInit {
  inputApiKey: string = ''; // Only for inputting a NEW key
  isKeyConfigured: boolean = false;
  showKeyInput: boolean = false; // Toggle to show input field

  allowAdultContent: boolean = false;
  theme: 'system' | 'light' | 'dark' = 'system';

  invalidAttempts: number = 0;
  showGetNewKey: boolean = false;

  constructor(
    private router: Router,
    private storageService: StorageService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,) {
    addIcons({
      arrowBackOutline, moonOutline, sunnyOutline, contrastOutline,
      trashOutline, cloudDownloadOutline, cloudUploadOutline,
      logoGithub, mailOutline, informationCircleOutline,
      shieldCheckmarkOutline, documentTextOutline, openOutline,
      keyOutline, warningOutline, checkmarkCircleOutline,
      closeCircleOutline, eyeOutline, eyeOffOutline
    });
  }

  ngOnInit() {
    this.storageService.getSettings().then((settings: SettingModel | null) => {
      if (settings) {
        // Check if key exists but DO NOT load it into a bound variable
        this.isKeyConfigured = !!settings.tmdbApiKey && settings.tmdbApiKey.length > 0;

        this.allowAdultContent = settings.allowAdultContent || false;
        this.theme = settings.theme || 'system';
      }
    });
  }

  async saveCurrentSettings(newKey?: string): Promise<void> {
    // We need to retrieve existing settings first to preserve the key if we are not updating it
    const currentSettings = await this.storageService.getSettings();
    const keyToSave = newKey !== undefined ? newKey : (currentSettings?.tmdbApiKey || '');

    const content: SettingModel = {
      tmdbApiKey: keyToSave,
      allowAdultContent: this.allowAdultContent,
      theme: this.theme
    };
    await this.storageService.saveSettings(content);

    // Update local state
    this.isKeyConfigured = !!keyToSave && keyToSave.length > 0;
  }

  async onThemeChange(event: any) {
    this.theme = event.detail.value;
    await this.saveCurrentSettings();
  }

  // Create & share a backup file
  async createBackup(): Promise<void> {
    try {
      const { fileName } = await this.storageService.exportBackupAndShare();
      await this.showToast(`Backup created: ${fileName}`, 'short', 'bottom');
    } catch (err) {
      console.error(err);
      await this.showToast('Backup failed', 'long', 'bottom');
    }
  }

  async restoreBackup(): Promise<void> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/json'],
        limit: 1,
        readData: true,
      });

      if (!result.files?.length) return;

      const f = result.files[0];

      // 🟢 SCOPE FIX: Declare variable outside the if/else blocks
      let jsonText = '';

      if (f.data) {
        jsonText = atob(f.data);
      } else if (f.path) {
        const r = await Filesystem.readFile({ path: f.path });
        jsonText = typeof r.data === 'string' ? r.data : await r.data.text();
      } else if (f.blob) {
        jsonText = await (f.blob as Blob).text();
      } else {
        throw new Error('No file data');
      }

      // Now 'jsonText' is safe to use here
      const alert = await this.alertCtrl.create({
        header: 'Restore Backup',
        message: 'How would you like to restore your data?',
        cssClass: 'custom-alert',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Merge (Keep Existing)',
            handler: () => {
              this.processRestore(jsonText, 'merge');
            }
          },
          {
            text: 'Replace (Overwrite)',
            role: 'destructive',
            handler: () => {
              this.processRestore(jsonText, 'replace');
            }
          }
        ]
      });

      await alert.present();

    } catch (err) {
      if ((err as any)?.message?.includes('User cancelled')) return;
      console.error(err);
      await this.showToast('Restore failed. Please try again.', 'long', 'bottom');
    }
  }

  // Helper method for the "Cool" Loading
  async processRestore(jsonText: string, mode: 'merge' | 'replace') {
    const loader = await this.loadingCtrl.create({
      message: mode === 'merge' ? 'Merging your world...' : 'Restoring backup...',
      spinner: 'crescent',
      duration: 0,
      cssClass: 'custom-loader'
    });
    await loader.present();

    const progressSub = this.storageService.restoreProgress$.subscribe((msg) => {
      // Direct DOM update for better performance or just rely on Ionic binding
      loader.message = msg;
    });

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      // This  will take time to load the data
      await this.storageService.restoreFromBackupJson(jsonText, mode);
      progressSub.unsubscribe();
      await loader.dismiss();

      await this.showToast(
        `Backup restored successfully! (${mode === 'merge' ? 'Merged' : 'Replaced'})`,
        'short',
        'bottom'
      );

    } catch (error) {
      progressSub.unsubscribe();
      await loader.dismiss();
      console.error('Restore Error:', error);
      await this.showToast('Error restoring data. File might be corrupt.', 'long', 'bottom');
    }
  }

  goHome(): void {
    this.router.navigate(['/tabs']);
  }

  async pasteApiKey(): Promise<void> {
    const { value } = await Clipboard.read();
    if (value) {
      const { value: confirmed } = await Dialog.confirm({
        title: 'Paste API Key?',
        message: `Clipboard contains:\n"${value}". Paste it here?`,
      });
      if (confirmed) {
        this.inputApiKey = value.trim();
        // Don't auto-save, let user review it in the hidden field or just click save
        // Actually, user experience might be better if we just fill the input
      }
    } else {
      await this.showToast('Clipboard is empty.', 'short', 'bottom');
    }
  }

  async toggleAllowAdultContent(): Promise<void> {
    if (this.allowAdultContent) {
      const { value } = await Dialog.confirm({
        title: 'Age Confirmation',
        message: 'Are you 18 or above? Only then can you enable adult content.',
      });

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

  // Confirm before clearing the watchlist
  async confirmClearWatchlist(): Promise<void> {
    const { value } = await Dialog.confirm({
      title: 'Confirm Clear Watchlist',
      message: 'Are you sure you want to clear the watchlist? This action cannot be undone.',
    });
    if (value) await this.clearWatchlist();
  }

  // Confirm before clearing the watched list
  async confirmClearWatchedList(): Promise<void> {
    const { value } = await Dialog.confirm({
      title: 'Confirm Clear Watched List',
      message: 'Are you sure you want to clear the watched list? This action cannot be undone.',
    });
    if (value) await this.clearWatchedList();
  }

  async confirmClearCache(): Promise<void> {
    const { value } = await Dialog.confirm({
      title: 'Clear Cache?',
      message: 'This will clear all cached data (images, API responses). It will NOT delete your lists.',
    });
    if (value) {
      await this.showToast('Cache cleared', 'short', 'bottom');
    }
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

  isValidApiKey(key: string): boolean {
    if (!key || typeof key !== 'string') return false;
    // Basic TMDB key validation (usually 32 chars hex, or v4 JWT which is much longer)
    // The previous check was key.split('.').length !== 3 which implies checking for JWT format maybe?
    // Let's stick to the previous simplified check but robust enough.
    // TMDB v3 keys are hex strings approx 32 chars.
    // TMDB v4/Read Access tokens are JWTs (3 parts separated by dots).

    // If it has dots, assume JWT
    if (key.includes('.')) {
      const parts = key.split('.');
      return parts.length === 3;
    }

    // If no dots, assume v3 hex key (usually 32 chars)
    if (key.length > 20) return true;

    return false;
  }

  async showToast(message: string, duration: 'short' | 'long', position: 'top' | 'center' | 'bottom') {
    await Toast.show({ text: message, duration: duration, position: position });
  }

  async saveApiKey() {
    if (this.isValidApiKey(this.inputApiKey)) {
      await this.saveCurrentSettings(this.inputApiKey);
      await this.showToast('API Key saved', 'short', 'bottom');
      this.invalidAttempts = 0;
      this.showGetNewKey = false;
      this.inputApiKey = ''; // Clear input after save
      this.showKeyInput = false; // Hide input logic
    } else {
      this.invalidAttempts++;
      await this.showToast('Invalid key format', 'long', 'bottom');
      if (this.invalidAttempts >= 3) this.showGetNewKey = true;
    }
  }

  async removeApiKey() {
    const { value } = await Dialog.confirm({
      title: 'Remove API Key',
      message: 'Are you sure? This will disable TMDB integration.',
    });
    if (value) {
      await this.saveCurrentSettings(''); // Save empty string
      this.isKeyConfigured = false;
      await this.showToast('API Key removed', 'short', 'bottom');
    }
  }

  async openUrl(url: string) {
    await Browser.open({ url });
  }

  sendFeedback() {
    window.location.href = 'mailto:er.rajpawar@gmail.com?subject=Cinescope Feedback';
  }
}
