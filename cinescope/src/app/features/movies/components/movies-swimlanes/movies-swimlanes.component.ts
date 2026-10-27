import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import { SwimlaneComponent } from '../../../../shared/components/swimlane/swimlane.component';
import { SwimlaneItem } from '../../../../shared/models/swimlane-item.interface';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';

@Component({
  selector: 'app-movies-swimlanes',
  standalone: true,
  imports: [CommonModule, SwimlaneComponent],
  templateUrl: './movies-swimlanes.component.html',
  styleUrls: ['./movies-swimlanes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MoviesSwimlanesComponent {
  public watchlistMovies = input.required<ContentDocType[]>();

  public readonly shortAndSweetSwimlane = computed<SwimlaneItem[]>(() => {
    return this.watchlistMovies()
      .filter(item => {
        const payload = item.payload as Record<string, unknown> | undefined;
        const runtime = Number(payload?.['runtime'] || 0);
        return runtime > 0 && runtime <= 95;
      })
      .map(doc => this.toSwimlaneItem(doc));
  });

  public readonly acclaimedSwimlane = computed<SwimlaneItem[]>(() => {
    return this.watchlistMovies()
      .filter(item => {
        const payload = item.payload as Record<string, unknown> | undefined;
        const rating = Number(payload?.['vote_average'] || 0);
        return rating >= 8.0;
      })
      .map(doc => this.toSwimlaneItem(doc));
  });

  public readonly allWatchlistSwimlane = computed<SwimlaneItem[]>(() => {
    return this.watchlistMovies().map(doc => this.toSwimlaneItem(doc));
  });

  private toSwimlaneItem(doc: ContentDocType): SwimlaneItem {
    const p = doc.payload as Record<string, unknown>;
    const rawPath = (p?.['poster_path'] || p?.['posterUrl']) as string | undefined;
    const rawDate = (p?.['release_date'] || p?.['first_air_date'] || '') as string;
    const year = rawDate ? rawDate.substring(0, 4) : undefined;
    const runtime = Number(p?.['runtime'] || 0);
    const runtimeStr = runtime > 0 ? `${runtime}m` : undefined;

    return {
      id: doc.tmdbId,
      title: String(p?.['title'] || p?.['name'] || 'Untitled'),
      posterUrl: resolveMediaImageUrl(rawPath, 'w500'),
      mediaType: 'movie',
      subtitle: [year, runtimeStr].filter(Boolean).join(' • '),
      payload: p
    };
  }
}
