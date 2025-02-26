import { Component } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
})
export class SettingsComponent {

  tmdbApiKey: string = ''; // Placeholder for API key

  constructor(
    private navCtrl: NavController,
    private toastController: ToastController
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
}
