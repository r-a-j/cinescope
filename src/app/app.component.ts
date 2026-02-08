import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StorageService } from 'src/services/storage.service';
import { SettingModel } from 'src/models/setting.model';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(private storageService: StorageService) { }

  ngOnInit() {
    this.storageService.storageChanged$.subscribe(() => {
      this.applyTheme();
    });
    this.applyTheme();
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
