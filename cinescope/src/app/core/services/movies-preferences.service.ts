import { Injectable, signal, inject } from '@angular/core';
import { ToastService } from './toast.service';
import {
  MoviesSectionVisibility,
  DEFAULT_MOVIES_VISIBILITY
} from '../../features/movies/movies.models';

const STORAGE_KEY_MOVIES_VISIBILITY = 'cinescope_movies_visibility';

@Injectable({
  providedIn: 'root'
})
export class MoviesPreferencesService {
  private toast = inject(ToastService);

  public readonly visibility = signal<MoviesSectionVisibility>(this.loadStoredVisibility());

  private loadStoredVisibility(): MoviesSectionVisibility {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MOVIES_VISIBILITY);
      if (saved) {
        return { ...DEFAULT_MOVIES_VISIBILITY, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return { ...DEFAULT_MOVIES_VISIBILITY };
  }

  public toggleSection(section: keyof MoviesSectionVisibility): void {
    this.visibility.update(current => {
      const updated = { ...current, [section]: !current[section] };
      try {
        localStorage.setItem(STORAGE_KEY_MOVIES_VISIBILITY, JSON.stringify(updated));
      } catch {
        // ignore storage error
      }
      return updated;
    });
  }

  public async resetToDefault(): Promise<void> {
    this.visibility.set({ ...DEFAULT_MOVIES_VISIBILITY });
    try {
      localStorage.setItem(STORAGE_KEY_MOVIES_VISIBILITY, JSON.stringify(DEFAULT_MOVIES_VISIBILITY));
    } catch {
      // ignore storage error
    }
    await this.toast.presentSuccess('Restored all Movies Lounge sections to visible', 2000);
  }
}
