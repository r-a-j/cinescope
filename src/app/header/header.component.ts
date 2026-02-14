import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButton,
  IonIcon,
  IonButtons,
  IonImg,
  IonTabButton
} from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import { searchOutline, settingsOutline, camera } from 'ionicons/icons';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [
    IonTabButton,
    IonImg,
    IonButtons,
    IonIcon,
    IonButton,
    IonHeader,
    IonToolbar
  ],
  standalone: true,
})
export class HeaderComponent {

  constructor(private router: Router) {
    addIcons({ camera, searchOutline, settingsOutline });
  }

  goToMovie() {
    this.router.navigate(['tabs/movie']);
  }

  goToSearch() {
    this.router.navigate(['/search']);
  }

  goToSetting() {
    this.router.navigate(['/setting']);
  }

}
