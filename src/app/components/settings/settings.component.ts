import { Component, OnInit } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { of, switchMap } from 'rxjs';
import { User } from 'src/app/models/user';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
})
export class SettingsComponent implements OnInit {
  tmdbApiKey: string = ''; // API key placeholder
  newUserName = '';
  userList: User[] = [];
  isWeb: any;

  constructor(
    private navCtrl: NavController,
    private toastController: ToastController,
    private storage: StorageService
  ) { }

  // Remove localStorage-based API key load; instead load from DB on init.
  async ngOnInit() {
    try {
      // Load users as before.
      this.storage.userState().pipe(
        switchMap(res => {
          if (res) {
            return this.storage.fetchUsers();
          } else {
            return of([]);
          }
        })
      ).subscribe(data => {
        this.userList = data;
      });

      // Load the TMDB API key from the database.
      const savedKey = await this.storage.getSetting('tmdbApiKey');
      if (savedKey) {
        this.tmdbApiKey = savedKey;
      }
    } catch (err) {
      throw new Error(`Error: ${err}`);
    }
  }

  async clearWatchlist() {
    // Optionally, you can move watchlist storage to the DB.
    localStorage.removeItem('watchlist');
    await this.showToast('Watchlist cleared!', 'success');
  }

  async clearWatchedList() {
    // Optionally, you can move watched list storage to the DB.
    localStorage.removeItem('watchedList');
    await this.showToast('Watched list cleared!', 'success');
  }

  navigateBack() {
    this.navCtrl.back();
  }

  isValidApiKey(key: string): boolean {
    // Check if key is a non-empty string.
    if (!key || typeof key !== 'string') {
      return false;
    }

    // A valid JWT should have 3 parts separated by periods.
    const parts = key.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Each part should contain only valid JWT characters.
    const jwtRegex = /^[A-Za-z0-9\-_]+$/;
    if (!parts.every(part => jwtRegex.test(part))) {
      return false;
    }

    try {
      // Decode the header and payload parts from base64.
      const headerJson = atob(parts[0]);
      const payloadJson = atob(parts[1]);

      // Parse the JSON strings.
      const header = JSON.parse(headerJson);
      const payload = JSON.parse(payloadJson);

      // Ensure the header contains an algorithm.
      if (!header.alg) {
        return false;
      }

      // Check for required fields in payload (adjust these as necessary).
      if (!payload.aud || !payload.sub) {
        return false;
      }

    } catch (error) {
      // If decoding or parsing fails, the key is not valid.
      return false;
    }

    // All checks passed.
    return true;
  }

  async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
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

  async createUser() {
    await this.storage.addUser(this.newUserName);
    this.newUserName = '';
    console.log(this.userList, '#users');
  }

  updateUser(user: User) {
    const active = user.active === 0 ? 1 : 0;
    this.storage.updateUserById(user.id.toString(), active);
  }

  deleteUser(user: User) {
    this.storage.deleteUserById(user.id.toString());
  }
}
