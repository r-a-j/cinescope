import { Injectable, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private navCtrl = inject(NavController);

  // Incremented on every home navigation request to notify subscribers
  public readonly resetDiscoverTrigger = signal<number>(0);

  public navigateToHome(): void {
    this.resetDiscoverTrigger.update(count => count + 1);
    this.navCtrl.navigateRoot('/tabs/discover', { animated: true, animationDirection: 'back' });
  }
}
