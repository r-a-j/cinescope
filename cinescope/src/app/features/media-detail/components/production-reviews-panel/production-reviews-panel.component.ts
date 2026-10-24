import { Component, ChangeDetectionStrategy, input, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { star, openOutline, chatbubblesOutline, sparkles, albumsOutline, chevronForwardOutline } from 'ionicons/icons';
import { TmdbBelongsToCollectionDto } from '../../../../core/dtos/movies/movie-detail.dto';
import { TmdbKeywordDto } from '../../../../core/dtos/keywords/keyword.dto';
import { TmdbReviewDto } from '../../../../core/dtos/reviews/review.dto';
import { ExternalLinkVm } from '../../media-detail.page';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';
import { FranchiseAggregatorService } from '../../../../core/services/franchise-aggregator.service';
import { FranchiseCollectionSummary } from '../../../../core/models/franchise.model';

@Component({
  selector: 'app-production-reviews-panel',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './production-reviews-panel.component.html',
  styleUrls: ['./production-reviews-panel.component.scss'],
})
export class ProductionReviewsPanelComponent {
  private router = inject(Router);
  private franchiseAggregator = inject(FranchiseAggregatorService);
  public mediaId = input<number>(0);
  public collection = input<TmdbBelongsToCollectionDto | null>(null);
  public productionFacts = input.required<{ label: string; value: string }[]>();
  public keywords = input.required<TmdbKeywordDto[]>();
  public externalLinks = input.required<ExternalLinkVm[]>();
  public reviews = input.required<TmdbReviewDto[]>();
  public mediaType = input<'movie' | 'tv'>('movie');
  public mediaTitle = input<string>('');
  public imdbId = input<string | null>(null);

  public expandedReviewIds = signal<Record<string, boolean>>({});

  /**
   * Resolves if this Movie or TV Series belongs to an active Universe or Franchise in the user's library.
   */
  public activeFranchiseSummary = computed<FranchiseCollectionSummary | null>(() => {
    const id = this.mediaId();
    const type = this.mediaType();
    const colId = this.collection()?.id ?? null;
    if (!id && !colId) return null;
    return this.franchiseAggregator.findFranchiseForMedia(id, type, colId);
  });

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
    addIcons({ star, openOutline, chatbubblesOutline, sparkles, albumsOutline, chevronForwardOutline });
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

  public onCollectionClick(col: TmdbBelongsToCollectionDto | FranchiseCollectionSummary): void {
    if (!col || !col.id) return;
    void this.router.navigate(['/collection', col.id], {
      state: {
        title: col.name,
        preview: {
          id: col.id,
          name: col.name,
          posterUrl: col.poster_path ? resolveMediaImageUrl(col.poster_path, 'w500') : undefined,
          backdropUrl: col.backdrop_path ? resolveMediaImageUrl(col.backdrop_path, 'w1280') : undefined
        }
      }
    });
  }
}
