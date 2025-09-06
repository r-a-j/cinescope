import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonCardHeader,
  IonCard,
  IonCardContent,
  IonItem,
  IonCardTitle,
  IonLabel,
  IonNote,
  IonInput,
  IonToggle,
  IonToolbar,
  IonButtons,
  IonIcon,
  IonHeader,
  IonTitle,
} from '@ionic/angular/standalone';
import { Toast } from '@capacitor/toast';
import { Clipboard } from '@capacitor/clipboard';
import { Dialog } from '@capacitor/dialog';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { StorageService } from 'src/services/storage.service';
import { SettingModel } from 'src/models/setting.model';
import { Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { FilePicker } from '@capawesome/capacitor-file-picker';

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
    IonCardTitle,
    IonItem,
    IonCardContent,
    IonCard,
    IonCardHeader,
    IonButton,
    IonContent,
    CommonModule,
    FormsModule,
  ],
})
export class SettingPage implements OnInit {
  tmdbApiKey: string = '';
  allowAdultContent: boolean = false;
  invalidAttempts: number = 0;
  showGetNewKey: boolean = false;

  constructor(private router: Router, private storageService: StorageService) {
    addIcons({ arrowBackOutline });
  }

  ngOnInit() {
    this.storageService.getSettings().then((settings: SettingModel | null) => {
      if (settings) {
        this.tmdbApiKey = settings.tmdbApiKey || '';
        this.allowAdultContent = settings.allowAdultContent || false;
      }
    });
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

  // Pick a .json and restore (default: merge; hold "replace" behind a confirm)
  async restoreBackup(): Promise<void> {
    try {
      // Let user choose any .json
      const result = await FilePicker.pickFiles({
        types: ['application/json'],
        limit: 1,
        readData: true, // returns base64; fine for small JSON backups
      }); // :contentReference[oaicite:7]{index=7}

      if (!result.files?.length) return;

      const f = result.files[0];

      // Obtain the text content (prefer base64 data if provided)
      let jsonText: string;
      if (f.data) {
        // base64 -> UTF-8 string
        jsonText = atob(f.data);
      } else if (f.path) {
        const r = await Filesystem.readFile({ path: f.path });
        jsonText = typeof r.data === 'string' ? r.data : await r.data.text();
      } else if (f.blob) {
        jsonText = await (f.blob as Blob).text();
      } else {
        throw new Error('No file data');
      }

      // Ask user how to apply
      const { value: replace } = await Dialog.confirm({
        title: 'Restore Backup',
        message: 'Replace existing lists & settings? (Cancel = Safe Merge)',
      });

      await this.storageService.restoreFromBackupJson(
        jsonText,
        replace ? 'replace' : 'merge'
      );
      await this.showToast(
        `Backup restored (${replace ? 'replaced' : 'merged'})`,
        'short',
        'bottom'
      );
    } catch (err) {
      if ((err as any)?.message?.includes('User cancelled')) return;
      console.error(err);
      await this.showToast('Restore failed', 'long', 'bottom');
    }
  }

  // Navigate back to home (adjust the route as needed)
  goHome(): void {
    this.router.navigate(['/tabs']); // Example route for home
  }

  async pasteApiKey(): Promise<void> {
    const { value } = await Clipboard.read();

    if (value) {
      const { value: confirmed } = await Dialog.confirm({
        title: 'Paste API Key?',
        message: `Clipboard contains:\n"${value}". Paste it here?`,
      });

      if (confirmed) {
        this.tmdbApiKey = value.trim();
        // await this.showToast('Pasted from clipboard', 'short', 'bottom');
      }
    } else {
      await this.showToast('Clipboard is empty.', 'short', 'bottom');
    }
  }

  async toggleAllowAdultContent(): Promise<void> {
    console.log(
      'Toggle requested. Current allowAdultContent:',
      this.allowAdultContent
    );

    if (this.allowAdultContent) {
      const { value } = await Dialog.confirm({
        title: 'Age Confirmation',
        message: 'Are you 18 or above? Only then can you enable adult content.',
      });

      if (!value) {
        this.allowAdultContent = false;
        await this.saveCurrentSettings();
        await this.showToast('Adult content disabled!', 'short', 'bottom');
      } else {
        this.allowAdultContent = true;
        await this.saveCurrentSettings();
        await this.showToast('Adult content enabled!', 'short', 'bottom');
      }
    } else {
      // Toggle OFF
      this.allowAdultContent = false;
      await this.saveCurrentSettings();
      await this.showToast('Adult content disabled!', 'short', 'bottom');
    }

    console.log('Allow Adult Content toggled to:', this.allowAdultContent);
  }

  // Helper method
  async saveCurrentSettings(): Promise<void> {
    const content: SettingModel = {
      tmdbApiKey: this.tmdbApiKey,
      allowAdultContent: this.allowAdultContent,
    };
    await this.storageService.saveSettings(content);
  }

  // Confirm before clearing the watchlist
  async confirmClearWatchlist(): Promise<void> {
    const { value } = await Dialog.confirm({
      title: 'Confirm Clear Watchlist',
      message:
        'Are you sure you want to clear the watchlist? This action cannot be undone.',
    });

    if (value) {
      await this.clearWatchlist();
    }
  }

  // Confirm before clearing the watched list
  async confirmClearWatchedList(): Promise<void> {
    const { value } = await Dialog.confirm({
      title: 'Confirm Clear Watched List',
      message:
        'Are you sure you want to clear the watched list? This action cannot be undone.',
    });

    if (value) {
      await this.clearWatchedList();
    }
  }

  async clearWatchlist(): Promise<void> {
    await Preferences.set({
      key: 'watchlist_contents',
      value: JSON.stringify([]),
    });
    this.storageService.emitStorageChanged();
    await this.showToast('Watchlist cleared!', 'short', 'bottom');
  }

  async clearWatchedList(): Promise<void> {
    await Preferences.set({
      key: 'watched_contents',
      value: JSON.stringify([]),
    });
    this.storageService.emitStorageChanged();
    await this.showToast('Watched list cleared!', 'short', 'bottom');
  }

  isValidApiKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }
    const parts = key.split('.');
    if (parts.length !== 3) {
      return false;
    }
    const jwtRegex = /^[A-Za-z0-9\-_]+$/;
    if (!parts.every((part) => jwtRegex.test(part))) {
      return false;
    }
    try {
      const headerJson = atob(parts[0]);
      const payloadJson = atob(parts[1]);
      const header = JSON.parse(headerJson);
      const payload = JSON.parse(payloadJson);
      if (!header.alg) {
        return false;
      }
      if (!payload.aud || !payload.sub) {
        return false;
      }
    } catch (error) {
      return false;
    }
    return true;
  }

  async showToast(
    message: string,
    duration: 'short' | 'long',
    position: 'top' | 'center' | 'bottom'
  ) {
    await Toast.show({
      text: message,
      duration: duration,
      position: position,
    });
  }

  async saveApiKey() {
    if (this.isValidApiKey(this.tmdbApiKey)) {
      const content: SettingModel = {
        tmdbApiKey: this.tmdbApiKey,
        allowAdultContent: this.allowAdultContent,
      };
      this.storageService.saveSettings(content);

      await this.showToast('Successfully saved', 'short', 'bottom');

      this.invalidAttempts = 0;
      this.showGetNewKey = false;
    } else {
      this.tmdbApiKey = '';
      this.invalidAttempts++;

      await this.showToast('Invalid key', 'long', 'bottom');

      if (this.invalidAttempts >= 3) {
        this.showGetNewKey = true;
      }
    }
  }

  goToTMDB() {
    window.open(
      'https://developer.themoviedb.org/reference/intro/getting-started',
      '_blank'
    );
  }
}
