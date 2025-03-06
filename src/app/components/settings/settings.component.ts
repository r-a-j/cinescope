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

  tmdbApiKey: string = ''; // Placeholder for API key
  newUserName = ''
  userList: User[] = []
  isWeb: any

  constructor(
    private navCtrl: NavController,
    private toastController: ToastController,
    private storage: StorageService
  ) {
    // Load the API key from storage when the settings page loads
    const savedKey = localStorage.getItem('tmdbApiKey');
    if (savedKey) {
      this.tmdbApiKey = savedKey;
    }
  }

  async clearWatchlist() {
    localStorage.removeItem('watchlist'); // Clear the watchlist from localStorage
    await this.showToast('Watchlist cleared!', 'success');
  }

  async clearWatchedList() {
    localStorage.removeItem('watchedList'); // Clear the watched list from localStorage
    await this.showToast('Watched list cleared!', 'success');
  }

  navigateBack() {
    this.navCtrl.back(); // Navigates back to the previous page
  }

  isValidApiKey(key: string): boolean {
    // Basic validation logic (replace with your real validation logic)
    return key.trim().length === 32; // Example: TMDB keys are 32 characters long
  }

  async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000, // Toast is displayed for 2 seconds
      position: 'bottom', // Position: top, middle, or bottom
      color
    });
    toast.present();
  }

  async saveApiKey() {
    if (this.isValidApiKey(this.tmdbApiKey)) {
      localStorage.setItem('tmdbApiKey', this.tmdbApiKey.trim());
      await this.showToast('API key saved successfully!', 'success');
    } else {
      await this.showToast('Invalid API key. Please try again.', 'danger');
    }
  }

  ngOnInit() {
    try {
      this.storage.userState().pipe(
        switchMap(res => {
          if (res) {
            return this.storage.fetchUsers();
          } else {
            return of([]); // Return an empty array when res is false
          }
        })
      ).subscribe(data => {
        this.userList = data; // Update the user list when the data changes
      });

    } catch (err) {
      throw new Error(`Error: ${err}`);
    }
  }

  async createUser() {
    await this.storage.addUser(this.newUserName)
    this.newUserName = ''
    console.log(this.userList, '#users')
  }

  updateUser(user: User) {
    const active = user.active === 0 ? 1 : 0
    this.storage.updateUserById(user.id.toString(), active)
  }

  deleteUser(user: User) {
    this.storage.deleteUserById(user.id.toString())
  }
}
