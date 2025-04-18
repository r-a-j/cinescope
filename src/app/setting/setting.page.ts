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
  IonTitle
} from '@ionic/angular/standalone';
import { Toast } from '@capacitor/toast';
import { Clipboard } from '@capacitor/clipboard';
import { Dialog } from '@capacitor/dialog';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { StorageService } from 'src/services/storage.service';
import { SettingModel } from 'src/models/setting.model';
import { t } from '@angular/core/weak_ref.d-Bp6cSy-X';

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
    FormsModule
  ],
})
export class SettingPage implements OnInit {
  tmdbApiKey: string = '';
  allowAdultContent: boolean = false;
  invalidAttempts: number = 0;
  showGetNewKey: boolean = false;

  constructor(private router: Router,
    private storageService: StorageService,
  ) {
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
    // Log current state before toggling
    console.log('Toggle requested. Current allowAdultContent:', this.allowAdultContent);

    // If the toggle is turned ON, ask for age confirmation.
    if (this.allowAdultContent) {
      const { value } = await Dialog.confirm({
        title: 'Age Confirmation',
        message: 'Are you 18 or above? Only then can you enable adult content.'
      });

      if (!value) {
        // User did not confirm—revert the toggle.
        this.allowAdultContent = false;
        await Toast.show({
          text: 'Adult content disabled!',
          duration: 'short',
          position: 'bottom'
        });
      } else {        
        const content: SettingModel = {
          tmdbApiKey: this.tmdbApiKey,
          allowAdultContent: true,
        };
        this.storageService.saveSettings(content);
        
        await Toast.show({
          text: 'Adult content enabled!',
          duration: 'short',
          position: 'bottom'
        });
      }
    } else {
      // If toggling off, simply show a toast.
      await Toast.show({
        text: 'Adult content disabled!',
        duration: 'short',
        position: 'bottom'
      });
    }

    console.log('Allow Adult Content toggled to:', this.allowAdultContent);
  }

  // Confirm before clearing the watchlist
  async confirmClearWatchlist(): Promise<void> {
    const { value } = await Dialog.confirm({
      title: 'Confirm Clear Watchlist',
      message: 'Are you sure you want to clear the watchlist? This action cannot be undone.'
    });

    if (value) {
      await this.clearWatchlist();
    }
  }

  // Confirm before clearing the watched list
  async confirmClearWatchedList(): Promise<void> {
    const { value } = await Dialog.confirm({
      title: 'Confirm Clear Watched List',
      message: 'Are you sure you want to clear the watched list? This action cannot be undone.'
    });

    if (value) {
      await this.clearWatchedList();
    }
  }

  // Clear the watchlist and show a toast
  async clearWatchlist(): Promise<void> {
    console.log('Clearing Watchlist...');
    // Add your logic to clear the watchlist (e.g., call a service)
    await this.showToast('Watchlist cleared!', 'short', 'bottom');
  }

  // Clear the watched list and show a toast
  async clearWatchedList(): Promise<void> {
    console.log('Clearing Watched List...');
    // Add your logic to clear the watched list (e.g., call a service)
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
    if (!parts.every(part => jwtRegex.test(part))) {
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
    duration: "short" | "long",
    position: "top" | "center" | "bottom"
  ) {
    await Toast.show({
      text: message,
      duration: duration,
      position: position
    });
  }

  async saveApiKey() {
    if (this.isValidApiKey(this.tmdbApiKey)) {
      const content: SettingModel = {
        tmdbApiKey: this.tmdbApiKey,
        allowAdultContent: this.allowAdultContent
      };
      this.storageService.saveSettings(content);

      await this.showToast("Successfully saved", "short", 'bottom');

      this.invalidAttempts = 0;
      this.showGetNewKey = false;
    } else {
      this.tmdbApiKey = '';
      this.invalidAttempts++;

      await this.showToast("Invalid key", "long", "bottom");

      if (this.invalidAttempts >= 3) {
        this.showGetNewKey = true;
      }
    }
  }

  goToTMDB() {
    window.open('https://developer.themoviedb.org/reference/intro/getting-started', '_blank');
  }
}
