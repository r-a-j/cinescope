import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { BookmarkState } from '../../../../shared/components/poster-card/poster-card.component';

@Component({
  selector: 'app-detail-hero',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Floating Top Navigation Bar -->
    <div class="floating-nav">
      <button type="button" class="nav-pill-btn" (click)="backClick.emit()" aria-label="Go Back">
        <ion-icon name="arrow-back-outline"></ion-icon>
      </button>

      <div class="nav-actions">
        <button type="button" class="nav-pill-btn" (click)="shareClick.emit()" aria-label="Share">
          <ion-icon name="share-social-outline"></ion-icon>
        </button>
      </div>
    </div>

    <!-- Cinematic Hero Section -->
    <div class="hero-stage">
      <!-- Softly blurred ambient poster glow while high-res widescreen backdrop loads -->
      <img
        [src]="posterUrl()"
        alt=""
        aria-hidden="true"
        class="hero-ambient-underlay" />

      @if (backdropUrl(); as bgUrl) {
        <img
          [src]="bgUrl"
          [alt]="title()"
          class="hero-backdrop-img"
          [class.is-loaded]="isBackdropLoaded()"
          decoding="async"
          fetchpriority="high"
          (load)="onBackdropLoad()" />
      }
      <div class="hero-backdrop-scrim"></div>

      <div class="hero-foreground">
        <!-- Poster Thumbnail -->
        <div class="hero-poster-frame">
          <img
            [src]="posterUrl()"
            [alt]="title()"
            class="hero-poster-img"
            decoding="async"
            fetchpriority="high" />
          @if (bookmarkState() !== 'none') {
            <div class="poster-state-ribbon" [class.is-watched]="bookmarkState() === 'watched'">
              <ion-icon [name]="bookmarkState() === 'watched' ? 'checkmark-circle' : 'bookmark'"></ion-icon>
              <span>{{ bookmarkState() === 'watched' ? 'WATCHED' : 'WATCHLIST' }}</span>
            </div>
          }
        </div>

        <!-- Core Identity & Metadata -->
        <div class="hero-meta-col">
          <div class="meta-badges-row">
            <span class="type-pill" [class.is-tv]="mediaType() === 'tv'">
              {{ mediaType() === 'tv' ? 'TV SERIES' : 'MOVIE' }}
            </span>

            @if (certification()) {
              <span class="cert-pill">{{ certification() }}</span>
            }

            @if (statusLabel()) {
              <span class="status-pill">{{ statusLabel() }}</span>
            }
          </div>

          <h1 class="detail-title">{{ title() }}</h1>

          @if (originalTitle()) {
            <div class="original-title">{{ originalTitle() }}</div>
          }

          <div class="stats-inline-row">
            @if (ratingValue()) {
              <div class="rating-chip">
                <ion-icon name="star"></ion-icon>
                <span class="rating-num">{{ ratingValue() }}</span>
                @if (voteCountLabel()) {
                  <span class="vote-count">({{ voteCountLabel() }})</span>
                }
              </div>
            }

            @if (releaseYearLabel()) {
              <span class="stat-dot">•</span>
              <span class="stat-text">{{ releaseYearLabel() }}</span>
            }

            @if (runtimeLabel()) {
              <span class="stat-dot">•</span>
              <span class="stat-text">{{ runtimeLabel() }}</span>
            }
          </div>

          @if (genres().length > 0) {
            <div class="genre-chips-row">
              @for (genre of genres(); track genre) {
                <span class="genre-chip">{{ genre }}</span>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Primary Action Bar -->
    <div class="action-bar-section">
      <div class="action-buttons-grid">
        <button
          type="button"
          class="action-btn watchlist-btn"
          [class.active]="bookmarkState() === 'watchlist'"
          (click)="watchlistToggle.emit()">
          <ion-icon [name]="bookmarkState() === 'watchlist' ? 'bookmark' : 'bookmark-outline'"></ion-icon>
          <span>{{ bookmarkState() === 'watchlist' ? 'In Watchlist' : 'Watchlist' }}</span>
        </button>

        <button
          type="button"
          class="action-btn watched-btn"
          [class.active]="bookmarkState() === 'watched'"
          (click)="watchedToggle.emit()">
          <ion-icon [name]="bookmarkState() === 'watched' ? 'checkmark-circle' : 'checkmark-circle-outline'"></ion-icon>
          <span>{{ bookmarkState() === 'watched' ? 'Watched' : 'Mark Watched' }}</span>
        </button>

        @if (hasTrailer()) {
          <button
            type="button"
            class="action-btn trailer-btn"
            (click)="trailerClick.emit()">
            <ion-icon name="play-circle-outline"></ion-icon>
            <span>Trailer</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .floating-nav {
      position: fixed;
      top: calc(env(safe-area-inset-top, 12px) + 10px);
      left: 16px;
      right: 16px;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: space-between;
      pointer-events: none;
    }
    .nav-pill-btn {
      pointer-events: auto;
      width: 42px;
      height: 42px;
      border-radius: 999px;
      background: rgba(12, 12, 16, 0.74);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 21px;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .nav-pill-btn:active {
      transform: scale(0.92);
      background: rgba(30, 30, 38, 0.9);
    }
    .hero-stage {
      position: relative;
      width: 100%;
      min-height: 410px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 96px 16px 20px;
      overflow: hidden;
      background: #08080a;
    }
    .hero-ambient-underlay {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 30%;
      filter: blur(26px) saturate(1.25) brightness(0.42);
      transform: scale(1.18);
      pointer-events: none;
    }
    .hero-backdrop-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 20%;
      filter: saturate(1.1) brightness(0.74);
      opacity: 0;
      transform: scale(1.06);
      transition:
        opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
      will-change: opacity, transform;
    }
    .hero-backdrop-img.is-loaded {
      opacity: 1;
      transform: scale(1.01);
    }
    .hero-backdrop-scrim {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        rgba(8, 8, 10, 0.25) 0%,
        rgba(8, 8, 10, 0.68) 52%,
        rgba(8, 8, 10, 0.96) 85%,
        #08080a 100%
      );
    }
    .hero-foreground {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: flex-end;
      gap: 16px;
    }
    .hero-poster-frame {
      position: relative;
      width: 116px;
      min-width: 116px;
      aspect-ratio: 2 / 3;
      border-radius: 12px;
      overflow: hidden;
      border: 1.5px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.78);
      background: #141418;
    }
    .hero-poster-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .poster-state-ribbon {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(229, 9, 20, 0.92);
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      padding: 4px 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .poster-state-ribbon.is-watched {
      background: rgba(16, 185, 129, 0.94);
    }
    .poster-state-ribbon ion-icon {
      font-size: 12px;
    }
    .hero-meta-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .meta-badges-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .type-pill {
      background: var(--ion-color-primary, #e50914);
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.9px;
      padding: 3px 8px;
      border-radius: 5px;
    }
    .type-pill.is-tv {
      background: #6366f1;
    }
    .cert-pill {
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: rgba(255, 255, 255, 0.9);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .status-pill {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .detail-title {
      margin: 2px 0 0;
      font-size: 24px;
      font-weight: 800;
      line-height: 1.15;
      color: #ffffff;
      letter-spacing: 0.3px;
    }
    .original-title {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.55);
      font-style: italic;
    }
    .stats-inline-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.82);
    }
    .rating-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(245, 158, 11, 0.16);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
      padding: 2px 7px;
      border-radius: 6px;
      font-weight: 700;
    }
    .rating-chip ion-icon {
      font-size: 13px;
    }
    .rating-chip .vote-count {
      font-size: 11px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.65);
    }
    .stat-dot {
      color: rgba(255, 255, 255, 0.35);
    }
    .stat-text {
      font-weight: 500;
    }
    .genre-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }
    .genre-chip {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.85);
      font-size: 11px;
      font-weight: 500;
      padding: 3px 9px;
      border-radius: 999px;
    }
    .action-bar-section {
      padding: 8px 16px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .action-buttons-grid {
      display: flex;
      gap: 10px;
    }
    .action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 12px 10px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      color: #ffffff;
      cursor: pointer;
      transition: transform 0.14s ease, background 0.15s ease, border-color 0.15s ease;
    }
    .action-btn ion-icon {
      font-size: 18px;
    }
    .action-btn:active {
      transform: scale(0.96);
    }
    .action-btn.watchlist-btn.active {
      background: rgba(229, 9, 20, 0.22);
      border-color: #e50914;
      color: #ff4d57;
    }
    .action-btn.watched-btn.active {
      background: rgba(16, 185, 129, 0.22);
      border-color: #10b981;
      color: #34d399;
    }
    .action-btn.trailer-btn {
      background: linear-gradient(135deg, #e50914 0%, #b80710 100%);
      border-color: transparent;
      color: #ffffff;
    }
  `]
})
export class DetailHeroComponent {
  public mediaType = input.required<'movie' | 'tv'>();
  public title = input.required<string>();
  public originalTitle = input<string | null>(null);
  public posterUrl = input.required<string>();
  public backdropUrl = input<string | null>(null);
  public bookmarkState = input.required<BookmarkState>();
  public certification = input<string | null>(null);
  public statusLabel = input<string | null>(null);
  public ratingValue = input<string | null>(null);
  public voteCountLabel = input<string | null>(null);
  public releaseYearLabel = input<string>('');
  public runtimeLabel = input<string | null>(null);
  public genres = input<string[]>([]);
  public hasTrailer = input<boolean>(false);

  public backClick = output();
  public shareClick = output();
  public watchlistToggle = output();
  public watchedToggle = output();
  public trailerClick = output();

  public isBackdropLoaded = signal<boolean>(false);

  constructor() {
    effect(() => {
      const url = this.backdropUrl();
      this.isBackdropLoaded.set(!url);
    });
  }

  public onBackdropLoad(): void {
    this.isBackdropLoaded.set(true);
  }
}
