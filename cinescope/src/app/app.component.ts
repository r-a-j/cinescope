import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { Location } from '@angular/common';
import { SplashScreen } from '@capacitor/splash-screen';
import { NavController } from '@ionic/angular/standalone';

import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private platform = inject(Platform);
  private location = inject(Location);
  private navCtrl = inject(NavController);
  private themeService = inject(ThemeService); // Initializing theme management

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    this.platform.ready().then(() => {
      this.setupHardwareBackButton();
      
      // Warm Start: Hide splash screen gracefully after initialization
      setTimeout(() => {
        SplashScreen.hide();
      }, 200); 
    });
  }

  private setupHardwareBackButton(): void {
    // Priority 10 ensures this listener runs before Ionic's default handlers
    this.platform.backButton.subscribeWithPriority(10, async (processNextHandler) => {

      const currentPath = this.location.path();

      const secondaryTabs = [
        '/tabs/oracle', 
        '/tabs/vault', 
        '/tabs/social', 
        '/tabs/identity'
      ];

      if (currentPath === '/tabs/pulse' || currentPath === '' || currentPath === '/tabs') {
        // If they are on the ultimate absolute root (Pulse), exit app immediately on 1st swipe
        App.exitApp();
      } else if (secondaryTabs.includes(currentPath)) {
        // If they are on another tab, swiping back returns them to Pulse
        this.navCtrl.navigateRoot('/tabs/pulse', { animationDirection: 'back' });
      } else {
        // If they are anywhere else deep in the app (like Settings), let Ionic handle the back navigation natively
        processNextHandler();
      }
    });
  }
}
