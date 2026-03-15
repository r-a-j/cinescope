import { Component, OnInit, ChangeDetectionStrategy, inject, ViewChild } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonSearchbar, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent,
  IonSpinner, IonButton, NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timeOutline, closeCircle, searchOutline, filmOutline, tvOutline, personOutline, sparkles, sparklesOutline, alertCircle } from 'ionicons/icons';
import { SearchStore } from '../../core/store/search.store';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SearchStore],
  imports: [
    IonContent, IonHeader, IonToolbar, IonSearchbar, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent,
    IonSpinner, IonButton, CommonModule, FormsModule
  ]
})
export class SearchPage implements OnInit {
  public store = inject(SearchStore);
  private navCtrl = inject(NavController);

  @ViewChild(IonSearchbar) searchbar!: IonSearchbar;

  public trackById(index: number, item: { id: number }): number {
    return item.id;
  }
  public trackByString(index: number, item: string): string {
    return item;
  }

  constructor() {
    addIcons({ timeOutline, closeCircle, searchOutline, filmOutline, tvOutline, personOutline, sparkles, sparklesOutline, alertCircle });
  }

  ngOnInit(): void {
    this.store.loadRecentSearches();
  }

  public goBack(): void {
    this.navCtrl.back();
  }

  onSearchChange(event: Event | CustomEvent): void {
    const customEvent = event as CustomEvent;
    const query = customEvent.detail?.value;
    this.store.searchQuery(query || '');
  }

  clearSearch(): void {
    this.store.searchQuery('');
  }

  triggerSmartSearch(): void {
    if (!this.store.query().trim() || this.store.smartSearchRetryTimer() > 0) {
      return;
    }

    // Dismiss the virtual keyboard using standard Capacitor method (mobile)
    Keyboard.hide().catch(() => console.debug('[UI - Search Page] Keyboard native hide skipped'));

    // Always call native DOM blur for web/PWA/fallbacks natively
    if (this.searchbar) {
      this.searchbar.getInputElement().then((input: HTMLInputElement) => {
        input.blur();
      });
    }

    console.log('[UI - Search Page] Triggering Smart Search execution via Store');
    this.store.executeSmartSearch();
  }

  onSearchSubmit(): void {
    const query = this.store.query();
    if (query.trim()) {
      this.store.saveSearchToHistory(query);
    }
    // Dismiss the virtual keyboard using standard Capacitor method (mobile)
    Keyboard.hide().catch(() => console.debug('Keyboard native hide skipped'));

    // Always call native DOM blur for web/PWA/fallbacks natively
    if (this.searchbar) {
      this.searchbar.getInputElement().then((input: HTMLInputElement) => {
        input.blur();
      });
    }
  }

  onResultClick(): void {
    const query = this.store.query();
    if (query.trim()) {
      this.store.saveSearchToHistory(query);
    }
    // TODO: Route to detailed item page
  }

  loadMore(event: Event | CustomEvent): void {
    const target = event.target as HTMLIonInfiniteScrollElement;
    if (this.store.hasMore() && !this.store.isLoading() && !this.store.isAppending()) {
      this.store.loadNextPage().then(() => {
        if (target) {
          target.complete();
        }
      });
    } else {
      if (target) {
        target.complete();
      }
    }
  }

  applyRecentSearch(query: string): void {
    this.store.searchQuery(query);
  }

  removeRecentSearch(query: string, event: Event): void {
    event.stopPropagation();
    this.store.removeRecentSearch(query);
  }

  clearHistory(): void {
    this.store.clearRecentSearches();
  }
}
