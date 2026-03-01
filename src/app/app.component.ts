import { Component, inject, OnInit } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ExtractionService } from 'src/services/extraction.service';
import { StorageService } from 'src/services/storage.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private extractionService = inject(ExtractionService);

  constructor(private storageService: StorageService) {
    this.extractionService.initShareListener();
    this.extractionService.initNotificationTapListener();
  }

  async ngOnInit() {
    this.storageService.storageChanged$.subscribe(() => {
      this.applyTheme();
    });
    this.applyTheme();

    await LocalNotifications.requestPermissions();
  }

  private async applyTheme() {
    const settings = await this.storageService.getSettings();
    const theme = settings?.theme || 'system';

    document.body.classList.remove('dark', 'light');

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      this.toggleDarkClass(prefersDark.matches);
    } else {
      document.body.classList.add(theme);
    }
  }

  private toggleDarkClass(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.add('light');
    }
  }
}
