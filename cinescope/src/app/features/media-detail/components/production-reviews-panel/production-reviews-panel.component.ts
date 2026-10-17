import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
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

    <!-- COMMUNITY REVIEWS -->
    @if (reviews().length > 0) {
      <section class="detail-section">
        <h3 class="section-heading">COMMUNITY REVIEWS ({{ reviews().length }})</h3>
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
      </section>
    }
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
  `]
})
export class ProductionReviewsPanelComponent {
  public collection = input<TmdbBelongsToCollectionDto | null>(null);
  public productionFacts = input.required<{ label: string; value: string }[]>();
  public keywords = input.required<TmdbKeywordDto[]>();
  public externalLinks = input.required<ExternalLinkVm[]>();
  public reviews = input.required<TmdbReviewDto[]>();

  public expandedReviewIds = signal<Record<string, boolean>>({});

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
