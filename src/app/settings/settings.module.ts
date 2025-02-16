import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AlertController, IonicModule } from '@ionic/angular';

import { SettingsComponent } from './settings.component';
import { Router, RouterModule, Routes } from '@angular/router';
import { MovieService } from 'src/services/movie.service';

const routes: Routes = [
  {
    path: '',
    component: SettingsComponent
  }
];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [SettingsComponent],
  exports: [SettingsComponent]
})
export class SettingsComponentModule {
  tmdbApiKey: string = '';

  constructor(
    private router: Router,
    private movieService: MovieService,
    private alertController: AlertController
  ) { }

  navigateBack() {
    // Navigate back to home or previous page
    this.router.navigate(['/']);
  }

  saveApiKey() {
    // Save the API key to localStorage (or use a dedicated settings service)
    localStorage.setItem('tmdbApiKey', this.tmdbApiKey);
  }

  async clearWatchlist() {
    const alert = await this.alertController.create({
      header: 'Clear Watchlist',
      message: 'Are you sure you want to clear your watchlist?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Clear',
          handler: () => {
            this.movieService.watchlist = [];
          },
        },
      ],
    });
    await alert.present();
  }

  async clearWatchedList() {
    const alert = await this.alertController.create({
      header: 'Clear Watched List',
      message: 'Are you sure you want to clear your watched list?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Clear',
          handler: () => {
            this.movieService.watched = [];
          },
        },
      ],
    });
    await alert.present();
  }
}
