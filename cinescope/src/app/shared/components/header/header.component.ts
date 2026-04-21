import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, NavController } from '@ionic/angular/standalone';
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
  private navCtrl = inject(NavController);

  constructor() {
    addIcons({ searchOutline, settingsOutline });
  }

  public openSettings(): void {
    this.navCtrl.navigateForward('/settings', { 
      animated: true,
      animationDirection: 'forward'
    });
  }

  public openSearch(): void {
    this.navCtrl.navigateForward('/search', { 
      animated: true,
      animationDirection: 'forward'
    });
  }
}