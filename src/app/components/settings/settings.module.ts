import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AlertController, IonicModule } from '@ionic/angular';

import { SettingsComponent } from './settings.component';
import { Router, RouterModule, Routes } from '@angular/router';
import { MovieService } from 'src/app/services/movie.service';

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
}
