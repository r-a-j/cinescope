import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonHeader, IonToolbar, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, settingsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonButtons, IonButton, IonIcon],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  constructor() {
    addIcons({ searchOutline, settingsOutline });
  }
}