import { Component, ChangeDetectionStrategy, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { star, openOutline, chatbubblesOutline } from 'ionicons/icons';
import { TmdbBelongsToCollectionDto } from '../../../../core/dtos/movies/movie-detail.dto';
import { TmdbKeywordDto } from '../../../../core/dtos/keywords/keyword.dto';
import { TmdbReviewDto } from '../../../../core/dtos/reviews/review.dto';
import { ExternalLinkVm } from '../../media-detail.page';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';

@Component({
  selector: 'app-production-reviews-panel',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- MOVIE COLLECTION BANNER -->
    @if (collection(); as col) {
      <section class="detail-section">
        <div class="collection-banner">
          @if (col.backdrop_path || col.poster_path) {
            <img
              [src]="resolveCollectionImage(col.backdrop_path || col.poster_path)"
              [alt]="col.name"
              class="collection-bg"
              loading="lazy" />
          }
          <div class="collection-overlay">
            <span class="collection-kicker">PART OF THE FRANCHISE</span>
            <h4 class="collection-title">{{ col.name }}</h4>
          </div>
        </div>
      </section>
    }

    <!-- BOX OFFICE, PRODUCTION FACTS, KEYWORDS & EXTERNAL LINKS -->
    @if (productionFacts().length > 0 || keywords().length > 0 || externalLinks().length > 0) {
      <section class="detail-section">
        <h3 class="section-heading">DETAILS & PRODUCTION</h3>

        @if (productionFacts().length > 0) {
          <div class="facts-grid">
            @for (fact of productionFacts(); track fact.label) {
              <div class="fact-box">
                <span class="fact-label">{{ fact.label }}</span>
                <span class="fact-val">{{ fact.value }}</span>
              </div>
            }
          </div>
        }

        @if (keywords().length > 0) {
          <div class="keywords-block">
            <span class="sub-label">Themes & Keywords</span>
            <div class="keywords-cloud">
              @for (kw of keywords(); track kw.id) {
                <span class="keyword-tag">#{{ kw.name }}</span>
              }
            </div>
          </div>
        }

        @if (externalLinks().length > 0) {
          <div class="external-links-row">
            @for (ext of externalLinks(); track ext.label) {
              <a
                [href]="ext.url"
                target="_blank"
                rel="noopener noreferrer"
                class="ext-link-pill">
                <ion-icon [name]="ext.icon"></ion-icon>
                <span>{{ ext.label }}</span>
              </a>
            }
          </div>
        }
      </section>
    }

    <!-- COMMUNITY & CRITIC REVIEWS -->
    <section class="detail-section">
      <div class="reviews-section-header">
        <h3 class="section-heading">COMMUNITY REVIEWS</h3>
        @if (reviews().length > 0) {
          <span class="reviews-count-badge">{{ reviews().length }}</span>
        }
      </div>

      @if (reviews().length > 0) {
        <div class="reviews-stack">
          @for (rev of reviews(); track rev.id) {
            <div class="review-card">
              <div class="review-header">
                <div class="review-author-group">
                  <div class="review-author">{{ rev.author }}</div>
                  @if (rev.created_at) {
                    <div class="review-date">{{ rev.created_at.slice(0, 10) }}</div>
                  }
                </div>
                @if (rev.author_details.rating) {
                  <span class="review-score">★ {{ rev.author_details.rating }}/10</span>
                }
              </div>
              <p
                class="review-body"
                [class.clamped]="!expandedReviewIds()[rev.id] && rev.content.length > 280">
                {{ rev.content }}
              </p>
              @if (rev.content.length > 280) {
                <button
                  type="button"
                  class="text-toggle-btn"
                  (click)="toggleReviewExpand(rev.id)">
                  {{ expandedReviewIds()[rev.id] ? 'Show less' : 'Read full review' }}
                </button>
              }
            </div>
          }
        </div>

        <div class="reviews-more-bar">
          <span class="more-bar-label">More critic & audience reviews:</span>
          <div class="more-buttons-group">
            @if (imdbReviewUrl(); as url) {
              <a
                [href]="url"
                target="_blank"
                rel="noopener noreferrer"
                class="ext-review-pill imdb-pill">
                <ion-icon name="star"></ion-icon>
                <span>IMDb Reviews</span>
                <ion-icon name="open-outline" class="pill-open"></ion-icon>
              </a>
            }
            @if (rottenTomatoesUrl(); as url) {
              <a
                [href]="url"
                target="_blank"
                rel="noopener noreferrer"
                class="ext-review-pill rt-pill">
                <span class="rt-icon">🍅</span>
                <span>Rotten Tomatoes</span>
                <ion-icon name="open-outline" class="pill-open"></ion-icon>
              </a>
            }
          </div>
        </div>
      } @else {
        <!-- Fallback Empty State with Direct Buttons to IMDb & Rotten Tomatoes -->
        <div class="reviews-empty-box">
          <div class="empty-icon-wrap">
            <ion-icon name="chatbubbles-outline"></ion-icon>
          </div>
          <div class="empty-content">
            <h4 class="empty-heading">No Written TMDB Reviews Yet</h4>
            <p class="empty-text">
              Community reviews for this {{ mediaType() === 'tv' ? 'TV series' : 'movie' }} haven't been submitted to TMDB yet. Explore verified audience feedback and critic reviews on:
            </p>
            <div class="empty-buttons-row">
              @if (imdbReviewUrl(); as url) {
                <a
                  [href]="url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ext-review-btn imdb-btn">
                  <ion-icon name="star"></ion-icon>
                  <span>Read on IMDb</span>
                  <ion-icon name="open-outline" class="btn-open"></ion-icon>
                </a>
              }
              @if (rottenTomatoesUrl(); as url) {
                <a
                  [href]="url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ext-review-btn rt-btn">
                  <span class="rt-icon">🍅</span>
                  <span>Rotten Tomatoes</span>
                  <ion-icon name="open-outline" class="btn-open"></ion-icon>
                </a>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .detail-section {
      padding: 20px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .section-heading {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
    }
    .collection-banner {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      min-height: 112px;
      display: flex;
      align-items: center;
      padding: 18px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: #14141a;
    }
    .collection-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: brightness(0.45);
    }
    .collection-overlay {
      position: relative;
      z-index: 2;
    }
    .collection-kicker {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #fbbf24;
    }
    .collection-title {
      margin: 4px 0 0;
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
    }
    .facts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
      gap: 10px;
    }
    .fact-box {
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .fact-label {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: rgba(255, 255, 255, 0.48);
      font-weight: 700;
    }
    .fact-val {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
    }
    .keywords-block {
      margin-top: 14px;
    }
    .sub-label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: rgba(255, 255, 255, 0.48);
      font-weight: 700;
      margin-bottom: 8px;
    }
    .keywords-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .keyword-tag {
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.78);
      background: rgba(255, 255, 255, 0.06);
      padding: 4px 9px;
      border-radius: 6px;
    }
    .external-links-row {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ext-link-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #ffffff;
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
    }
    .reviews-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .review-card {
      padding: 14px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.07);
    }
    .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .review-author {
      font-size: 13.5px;
      font-weight: 700;
      color: #ffffff;
    }
    .review-date {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.45);
      margin-top: 2px;
    }
    .review-score {
      font-size: 11.5px;
      font-weight: 700;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.15);
      padding: 2px 7px;
      border-radius: 6px;
    }
    .review-body {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.82);
      white-space: pre-line;
    }
    .review-body.clamped {
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .text-toggle-btn {
      margin-top: 6px;
      padding: 0;
      background: none;
      border: none;
      color: var(--ion-color-primary, #e50914);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .reviews-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      .section-heading { margin-bottom: 0; }
    }
    .reviews-count-badge {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 7px;
      border-radius: 99px;
    }
    .reviews-more-bar {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .more-bar-label {
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.55);
      font-weight: 600;
    }
    .more-buttons-group, .empty-buttons-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .ext-review-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #ffffff;
      transition: background 0.15s ease, transform 0.1s ease;
      &:active { transform: scale(0.97); }
    }
    .ext-review-pill.imdb-pill ion-icon[name="star"] { color: #f5c518; }
    .pill-open, .btn-open { font-size: 13px; opacity: 0.65; }
    .rt-icon { font-size: 14px; line-height: 1; }

    .reviews-empty-box {
      display: flex;
      gap: 14px;
      padding: 16px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .empty-icon-wrap {
      width: 40px;
      height: 40px;
      min-width: 40px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: rgba(255, 255, 255, 0.6);
    }
    .empty-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .empty-heading {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
    }
    .empty-text {
      margin: 0 0 8px;
      font-size: 12.5px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.65);
    }
    .ext-review-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 9px;
      font-size: 12.5px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease;
      &:active { transform: scale(0.96); }
    }
    .ext-review-btn.imdb-btn {
      background: rgba(245, 197, 24, 0.14);
      border: 1px solid rgba(245, 197, 24, 0.35);
      color: #f5c518;
      ion-icon[name="star"] { font-size: 15px; }
    }
    .ext-review-btn.rt-btn {
      background: rgba(250, 50, 10, 0.12);
      border: 1px solid rgba(250, 50, 10, 0.3);
      color: #ff6b6b;
    }
  `]
})
export class ProductionReviewsPanelComponent {
  public collection = input<TmdbBelongsToCollectionDto | null>(null);
  public productionFacts = input.required<{ label: string; value: string }[]>();
  public keywords = input.required<TmdbKeywordDto[]>();
  public externalLinks = input.required<ExternalLinkVm[]>();
  public reviews = input.required<TmdbReviewDto[]>();
  public mediaType = input<'movie' | 'tv'>('movie');
  public mediaTitle = input<string>('');
  public imdbId = input<string | null>(null);

  public expandedReviewIds = signal<Record<string, boolean>>({});

  public imdbReviewUrl = computed<string | null>(() => {
    const id = this.imdbId();
    if (id) {
      return `https://www.imdb.com/title/${id}/reviews/`;
    }
    const title = this.mediaTitle();
    if (title) {
      return `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt`;
    }
    return null;
  });

  public rottenTomatoesUrl = computed<string | null>(() => {
    const title = this.mediaTitle();
    if (!title) return null;
    return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
  });

  constructor() {
    addIcons({ star, openOutline, chatbubblesOutline });
  }

  public toggleReviewExpand(reviewId: string): void {
    this.expandedReviewIds.update((curr) => ({
      ...curr,
      [reviewId]: !curr[reviewId]
    }));
  }

  public resolveCollectionImage(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w780');
  }
}
