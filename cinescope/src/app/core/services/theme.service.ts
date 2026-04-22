import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'cinescope-theme';
  
  // Current theme signal
  public themeMode = signal<ThemeMode>(this.loadTheme());

  constructor() {
    // Watch for theme changes and apply them
    effect(() => {
      const mode = this.themeMode();
      this.applyTheme(mode);
      localStorage.setItem(this.THEME_KEY, mode);
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this.themeMode() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  public setTheme(mode: ThemeMode) {
    this.themeMode.set(mode);
  }

  private loadTheme(): ThemeMode {
    const saved = localStorage.getItem(this.THEME_KEY) as ThemeMode;
    return saved || 'system';
  }

  private applyTheme(mode: ThemeMode) {
    const htmlElement = document.documentElement;
    let isDark = false;

    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      htmlElement.classList.add('ion-palette-dark');
    } else {
      htmlElement.classList.remove('ion-palette-dark');
    }
  }
}
