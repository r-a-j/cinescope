# Workspace Architecture Audit: Cinescope

## Layer 1: The Foundation (Environment & Build)

### Core Framework Versions
Based on `package.json`, the workspace relies on the following exact core versions:
- **Angular:** `^19.0.0`
- **Ionic:** `@ionic/angular: ^8.0.0`
- **Capacitor:** `@capacitor/core: 7.1.0` (CLI `7.1.0`)

### Major Third-Party Structural Libraries
- **Reactive Extensions:** `rxjs: ~7.8.0`
- **Animations:** `animate.css: ^4.1.1` and `@angular/animations`
- **Capacitor Plugins:** Strong reliance on native APIs, notably `@capacitor/filesystem`, `@capacitor/preferences`, `@capacitor/share`, `@capawesome/capacitor-file-picker`, and `@capacitor/local-notifications`. 
- *(Note: No Firebase, SQLite, or dedicated Redux-style libraries are currently present in dependencies.)*

### Target Platforms (Capacitor Config)
- **Android:** Enabled (`@capacitor/android: 7.1.0` is present).
- **Web:** Configured via `capacitor.config.ts` (`webDir: 'www'`).
- *(Note: iOS target is not explicitly present in package dependencies.)*

---

## Layer 2: Global Configuration & Routing

### Global Configuration & Initialization
The app is initialized in `main.ts` using the Standalone Component architecture (no `app.module.ts`).
Key global providers include:
- **RouteStrategy:** `RouteReuseStrategy` is mapped to `IonicRouteStrategy`.
- **Ionic Configuration:** Initialized explicitly via `provideIonicAngular()`.
- **Animations:** Enabled globally via `provideAnimationsAsync()`.

### Routing Architecture
From `app.routes.ts`, the application uses a Standalone, Lazy-Loaded routing strategy:
- Tab routing is deferred to `tabs.routes.ts` via `loadChildren`.
- High-level standalone pages are dynamically imported via `loadComponent` (e.g., `SearchPage`, `SettingPage`, `MovieDetailPage`, `TvDetailPage`).
- Preloading strategy is configured globally in `main.ts`: `withPreloading(PreloadAllModules)`.

### Interceptors & Guards
- **Global HTTP Interceptors:** A single HTTP Interceptor is provided globally: `authInterceptor`.
- *(Note: No global route Guards are currently configured in `main.ts` or `app.routes.ts`.)*

---

## Layer 3: Data & State Architecture

### State Management
State management is handled primarily through **RxJS `BehaviorSubjects`** combined with **Capacitor `Preferences`**. Rather than a global store like NgRx or Elf, or purely Angular 19 Signals, the architecture relies on specific Singleton Services emitting reactive streams (e.g., `storageChanged$`) to trigger localized component refreshes.

### Core Data Services
The `StorageService` (`storage.service.ts`) acts as the localized database engine, abstracting CRUD operations over `Preferences` for entities like Inbox, Watchlist, and Watched lists. It implements manual deduplication, background data hydration directly from external APIs (`TmdbSearchService`), and payload-based Backup/Restore mechanisms using Capacitor `Filesystem`. 

#### Representative Code Snippet (`StorageService` snippet)
```typescript
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly WATCHLIST_KEY = 'watchlist_contents';
  private storageChangedSource = new BehaviorSubject<void>(undefined);
  storageChanged$ = this.storageChangedSource.asObservable(); // Reactive broadcast

  async getWatchlist(): Promise<ContentModel[]> {
    return this.getList(this.WATCHLIST_KEY);
  }

  async addToWatchlist(content: ContentModel): Promise<void> {
    const watchlist = await this.getList(this.WATCHLIST_KEY);
    if (!watchlist.find(c => c.contentId === content.contentId && c.isMovie === content.isMovie)) {
      watchlist.push(content);
      await Preferences.set({ key: this.WATCHLIST_KEY, value: JSON.stringify(watchlist) });
    }
    this.storageChangedSource.next(); // Trigger UI updates
  }
}
```

---

## Layer 4: UI, Theming, & Gestures

### Global Overrides
- **Typography:** `global.scss` aggressively overrides font variables across Ionic components (`ion-title`, `ion-button`, `h1`-`h6`, etc.) forcing standard `family: "Bebas Neue", sans-serif !important;`.
- **UI Elements Modification:** Standard Ionic box-shadows and borders are entirely stripped from structural components (`ion-header`, `ion-toolbar`, `ion-content`) to promote flat design. 
- **Variable Theming:** `theme/variables.scss` dictates a rigorous, customized color palette leveraging `--ion-color-primary` mapped directly to native Ionic CSS variables depending on `.light` and `.dark` wrapper classes on the body element.

### Ionic Component Utilization
The application utilizes a **hybrid approach**. It relies on standard internal Ionic structural components (`ion-content`, `ion-list`, `ion-item`, `ion-button`), but utilizes **extensive Custom CSS classes** (e.g., `.tinder-card`, `.glass-btn`, `.media-grid`, `.card-stack`) for specific micro-interfaces instead of purely sticking to Ionic's default Shadow DOM styling.

---

## Layer 5: The Active Playground (Current Focus)

### Current Active Component
The recent focus of development is the **`InboxComponent`** (`src/app/inbox/inbox.component.ts`), an interactive, Swipeable Card Interface. 

### Deduced Immediate Business Logic
You are building a Tinder-style "Inbox" sorting mechanism. Users are presented with a stack of movies/TV shows and can quickly categorize them via gestures: 
- **Swipe Left:** Discard.
- **Swipe Right:** Add to Watchlist.
- **Swipe Up:** Mark as Watched.
There is additionally a toggle to switch to a 'list view' allowing bulk selection and actions with an "Undo" pattern utilizing Toast notifications.

### Top 2 Technical Challenges
1. **Gesture Lifecycle vs. DOM Rendering Race Conditions:**
   The `GestureController` applies direct spatial manipulation (`el.style.transform`) independent of Angular's rendering engine. When a card is dismissed, the component uses `setTimeout(..., 300)` combined with `swipedNode.style.transition = 'none';` to clean up the DOM node just *before* slicing the Angular view array (`this.inboxItems.shift()`). Synchronizing these two differing engines precisely without visual glitching or phantom nodes is highly difficult, evidenced by the comments (`🚨 1. CAPTURE THE EXACT DOM NODE BEFORE IT DELETES`).
2. **Optimistic UI Updates & Batch Synchronization Flushes:**
   When executing bulk actions from the list view, the UI avoids immediate `StorageService` commits to allow the user an opportunity to "Undo" via the Toast component. This requires maintaining separate transient states (`pendingCommitIds` `Set`) to shadow the source of truth, creating complexity around array reconciliation if the user navigates away or triggers overlapping interactions.

---

### Snippets of the Active Playground (`InboxComponent`)

<details>
<summary><b>Click to expand: inbox.component.ts</b></summary>

```typescript
import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, AfterViewInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, GestureController, GestureDetail, Gesture } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { StorageService } from 'src/services/storage.service';
import { ExtractionService } from 'src/services/extraction.service';
import { ContentModel } from 'src/models/content.model';
import { Subscription, Observable } from 'rxjs';

@Component({
    selector: 'app-inbox',
    templateUrl: './inbox.component.html',
    styleUrls: ['./inbox.component.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
})
export class InboxComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChildren('tinderCard') tinderCards!: QueryList<ElementRef>;

    inboxItems: ContentModel[] = [];
    currentItem: ContentModel | null = null;
    swipeClass: 'swipe-left' | 'swipe-right' | 'swipe-up' | '' = '';
    isAnimating = false;
    viewMode: 'swipe' | 'list' = 'swipe';

    selectedIds = new Set<string>();
    pendingCommitIds = new Set<string>(); // Used to prevent flashing of items mid-toast
    extractionState$!: Observable<{ isExtracting: boolean; text: string }>;

    private storageSub?: Subscription;
    private querySub?: Subscription;
    private cardGesture?: Gesture;

    constructor(
        private storageService: StorageService,
        private extractionService: ExtractionService,
        private toastController: ToastController,
        private gestureCtrl: GestureController,
        private router: Router,
        private ngZone: NgZone,
    ) { }

    ngOnInit() {
        this.extractionState$ = this.extractionService.extractionState$;
        this.loadInbox();
        this.storageSub = this.storageService.storageChanged$.subscribe(() => {
            if (!this.isAnimating) {
                this.loadInbox();
            }
        });
    }

    ngAfterViewInit() {
        if (this.tinderCards && this.tinderCards.length > 0 && !this.isAnimating) {
            this.initGesture(this.tinderCards.first);
        }
        this.querySub = this.tinderCards.changes.subscribe((cards) => {
            if (cards.length > 0 && !this.isAnimating) {
                this.initGesture(cards.first);
            } else if (this.cardGesture) {
                this.cardGesture.destroy();
                this.cardGesture = undefined;
            }
        });
    }

    async loadInbox() {
        const fullInbox = await this.storageService.getInbox();
        this.inboxItems = fullInbox.filter(item => !this.pendingCommitIds.has(this.storageService['uniqKey'](item)));
        this.updateCurrentItem();
    }

    updateCurrentItem() {
        if (this.inboxItems.length > 0) {
            this.currentItem = this.inboxItems[0];
        } else {
            this.currentItem = null;
        }
    }

    // List view toggles/select logic omitted for brevity...

    async discard(fromGesture: boolean = false) {
        if (this.isAnimating || this.inboxItems.length === 0) return;
        this.isAnimating = true;

        if (!fromGesture) this.swipeClass = 'swipe-left';

        const itemToProcess = this.inboxItems[0];
        const swipedNode = this.tinderCards.first?.nativeElement;

        setTimeout(async () => {
            if (swipedNode) {
                swipedNode.style.transition = 'none';
                swipedNode.style.transform = '';
            }

            this.inboxItems.shift();
            this.updateCurrentItem();
            this.resetAnimationState();

            await this.storageService.removeFromInbox(itemToProcess.contentId, itemToProcess.isMovie, itemToProcess.isTv);
        }, 300);
    }

    // Similar functions exist for markWatched (swipe up) and markWatchlist (swipe right).

    private resetAnimationState() {
        this.swipeClass = '';
        this.isAnimating = false;
    }

    private initGesture(cardElement: ElementRef) {
        if (this.cardGesture) {
            this.cardGesture.destroy();
        }

        const el = cardElement.nativeElement;

        this.cardGesture = this.gestureCtrl.create({
            el,
            gestureName: 'swipe-card',
            gesturePriority: 100,
            threshold: 5,
            direction: 'x',
            maxAngle: 150,

            onStart: () => {
                el.style.transition = 'none';
            },
            onMove: (detail: GestureDetail) => {
                const x = detail.deltaX;
                const y = detail.deltaY;
                const rotation = x / 20;

                el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
            },
            onEnd: (detail: GestureDetail) => {
                this.ngZone.run(() => {
                    const { deltaX: x, deltaY: y, velocityX, velocityY } = detail;
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;

                    const swipeLeft = x < -120 || (velocityX < -0.5 && x < 0);
                    const swipeRight = x > 120 || (velocityX > 0.5 && x > 0);
                    const swipeUp = (y < -120 && Math.abs(x) < 100) || (velocityY < -0.5 && y < 0 && Math.abs(x) < 100);

                    if (swipeLeft || swipeRight || swipeUp) {
                        el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

                        if (swipeUp) {
                            el.style.transform = `translate(${x}px, -${windowHeight}px) rotate(${x / 20}deg)`;
                            this.markWatched(true);
                        } else if (swipeRight) {
                            el.style.transform = `translate(${windowWidth * 1.5}px, ${y + (velocityY * 100)}px) rotate(30deg)`;
                            this.markWatchlist(true);
                        } else if (swipeLeft) {
                            el.style.transform = `translate(-${windowWidth * 1.5}px, ${y + (velocityY * 100)}px) rotate(-30deg)`;
                            this.discard(true);
                        }
                    } else {
                        el.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                        el.style.transform = '';
                    }
                });
            }
        });

        this.cardGesture.enable(this.viewMode === 'swipe');
    }

    // Process bulk action functionality with Undo toast logic omitted for brevity...
}
```
</details>

<details>
<summary><b>Click to expand: inbox.component.html</b></summary>

```html
<ion-header class="ion-no-border">
    <ion-toolbar color="transparent">
        <ion-title>Inbox <span *ngIf="inboxItems.length > 0">({{ inboxItems.length }})</span></ion-title>
        <ion-buttons slot="end">
            <!-- Header buttons -->
        </ion-buttons>
    </ion-toolbar>
</ion-header>

<ion-content [fullscreen]="true">
    <div class="inbox-container">
        
        <!-- Empty State -->
        <div *ngIf="inboxItems.length === 0" class="empty-state">
            <ion-icon name="checkmark-circle-outline" color="success"></ion-icon>
            <p>You're all caught up!</p>
        </div>

        <!-- Swipe Card Stack -->
        <div *ngIf="viewMode === 'swipe' && inboxItems.length > 0" class="card-stack" [class.is-animating]="isAnimating">
            <div *ngFor="let item of inboxItems.slice(0, 2); let i = index; trackBy: trackById" #tinderCard
                class="tinder-card" [class.top-card]="i === 0" [class.next-card]="i === 1"
                [ngClass]="i === 0 ? swipeClass : ''" [class.animating]="isAnimating && i === 0">

                <div class="poster-container">
                    <img [src]="item.poster_path ? 'https://image.tmdb.org/t/p/w500' + item.poster_path : 'assets/placeholder.png'" alt="Poster">
                    <div class="gradient-overlay"></div>
                </div>

                <div class="info-container">
                    <h2>{{ item.title || item.name }}</h2>
                    <div class="meta-row">
                        <span class="year">{{ getYear(item) }}</span>
                        <span class="rating-badge" *ngIf="item.vote_average">
                            <ion-icon name="star"></ion-icon>
                            {{ item.vote_average | number:'1.1-1' }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Floating Action Buttons -->
        <div class="action-buttons" *ngIf="viewMode === 'swipe' && inboxItems.length > 0">
            <div class="glass-btn-wrapper">
                <div class="glass-btn discard" (click)="discard()" [class.disabled]="isAnimating">
                    <ion-icon name="close"></ion-icon>
                </div>
            </div>
            <!-- Swipe Up & Watchlist buttons -->
        </div>

        <!-- List View -->
        <div *ngIf="viewMode === 'list' && inboxItems.length > 0" class="list-view-container">
            <ion-list class="inbox-list" lines="none">
                <!-- Checkbox lines omitted for brevity -->
            </ion-list>
        </div>

    </div>
</ion-content>
```
</details>

<details>
<summary><b>Click to expand: inbox.component.scss (Core snippets)</b></summary>

```scss
.card-stack {
  position: relative;
  width: 90%;
  max-width: 400px;
  height: 65vh;
  margin-top: 20px;
  perspective: 1000px;

  &.is-animating {
    .next-card {
      transform: scale(1) translateY(0);
      opacity: 1;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out;
    }
  }
}

.tinder-card {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  background-color: var(--ion-color-step-100, #1e1e1e);
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease-out;
  display: flex;
  flex-direction: column;
  z-index: 10;

  &.top-card { z-index: 10; }
  &.next-card { z-index: 5; transform: scale(0.92) translateY(16px); opacity: 0.7; }
  &.animating { pointer-events: none; }

  &.swipe-left { transform: translateX(-150%) rotate(-30deg) !important; opacity: 0; }
  &.swipe-right { transform: translateX(150%) rotate(30deg) !important; opacity: 0; }
  &.swipe-up { transform: translateY(-150%) rotate(10deg) !important; opacity: 0; }
}

.action-buttons {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 25px;
  width: 100%;
  max-width: 400px;
  z-index: 5;

  .glass-btn {
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(255, 255, 255, 0.05);
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease, background 0.2s ease;
  }
}
```
</details>
