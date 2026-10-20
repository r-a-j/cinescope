import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, settingsOutline } from 'ionicons/icons';
import { NavigationService } from 'src/app/core/services/navigation.service';

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
  private navService = inject(NavigationService);

  constructor() {
    addIcons({ searchOutline, settingsOutline });
  }

  public onLogoClick(): void {
    this.navService.navigateToHome();
  }

  public openSettings(): void {
    this.navCtrl.navigateForward('/settings');
  }

  public openSearch(): void {
    this.navCtrl.navigateForward('/search', { animated: false }); // Instant open for search makes it feel snappy
  }
}
