import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, NavController, Platform, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { User } from 'src/app/models/user';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
})
export class SettingsComponent implements OnInit, OnDestroy {
  tmdbApiKey: string = ''; // API key placeholder
  newUserName = '';
  userList: User[] = [];
  isWeb: any;
  private backButtonSubscription!: Subscription;

  constructor(
    private navCtrl: NavController,
    private toastController: ToastController,
    private alertController: AlertController,
    private storage: StorageService,
    private platform: Platform
  ) { }

  ngOnInit() {
    this.storage.getSetting('tmdbApiKey').then(savedKey => {
      if (savedKey) {
        this.tmdbApiKey = savedKey;
      }
    });

    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.navigateBack();
    });
  }

  ngOnDestroy(): void {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
    }
  }

  async confirmClearWatchlist() {
    const alert = await this.alertController.create({
      header: 'Clear Watchlist',
      message: 'Are you sure you want to clear the watchlist? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear',
          handler: async () => {
            await this.clearWatchlist();
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmClearWatchedList() {
    const alert = await this.alertController.create({
      header: 'Clear Watched List',
      message: 'Are you sure you want to clear the watched list? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear',
          handler: async () => {
            await this.clearWatchedList();
          }
        }
      ]
    });

    await alert.present();
  }

  async clearWatchlist() {
    // Clear watchlist from the database
    await this.storage.clearMovieList('watchlist');
    await this.showToast('Watchlist cleared!', 'success');
  }

  async clearWatchedList() {
    // Clear watched list from the database
    await this.storage.clearMovieList('watched');
    await this.showToast('Watched list cleared!', 'success');
  }

  navigateBack() {
    this.navCtrl.back();
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

  async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'top',
      color
    });
    toast.present();
  }

  async saveApiKey() {
    if (this.isValidApiKey(this.tmdbApiKey)) {
      await this.storage.saveSetting('tmdbApiKey', this.tmdbApiKey.trim());
      await this.showToast('API key saved successfully!', 'success');
    } else {
      await this.showToast('Invalid API key. Please try again.', 'danger');
    }
  }
}
