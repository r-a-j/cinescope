import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { App } from '@capacitor/app';
import { Location } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private platform = inject(Platform);
  private location = inject(Location);

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    this.platform.ready().then(() => {
      this.setupHardwareBackButton();
    });
  }

  private setupHardwareBackButton(): void {
    // Priority 10 ensures this listener runs before Ionic's default handlers
    this.platform.backButton.subscribeWithPriority(10, (processNextHandler) => {

      const currentPath = this.location.path();

      // Define what you consider the "Absolute Home" routes
      const homeRoutes = ['/discover', '/home', '/archive', '/inbox', '', '/movies', '/tv'];

      if (homeRoutes.includes(currentPath)) {
        // If they are on the root tab and press back, exit the app
        App.exitApp();
      } else {
        // If they are anywhere else (like Settings), let Ionic handle the back navigation natively
        processNextHandler();
      }
    });
  }
}
