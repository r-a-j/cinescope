import { Component, ChangeDetectionStrategy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonSpinner } from '@ionic/angular/standalone';
import { TmdbTvEpisodeBaseDto, TmdbTvSeasonBaseDto } from '../../../../core/dtos/tv/tv-detail.dto';
import {
  TmdbTvSeasonDetailDto,
  TmdbTvSeasonEpisodeDto,
  TmdbTvSeasonCrewDto,
  TmdbTvSeasonGuestStarDto
} from '../../../../core/dtos/tv-seasons/tv-season-detail.dto';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';

@Component({
  selector: 'app-tv-seasons-hub',
  standalone: true,
  imports: [CommonModule, IonSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tv-seasons-hub.component.html',
  styleUrls: ['./tv-seasons-hub.component.scss'],
})
export class TvSeasonsHubComponent {
  private readonly router = inject(Router);

  public seasons = input.required<TmdbTvSeasonBaseDto[]>();
  public selectedSeasonNumber = input.required<number>();
  public activeSeasonDetail = input<TmdbTvSeasonDetailDto | null>(null);
  public episodes = input<TmdbTvSeasonEpisodeDto[]>([]);
  public isSeasonLoading = input<boolean>(false);
  public lastEpisodeToAir = input<TmdbTvEpisodeBaseDto | null>(null);
  public nextEpisodeToAir = input<TmdbTvEpisodeBaseDto | null>(null);
  public showStatus = input<string | null>(null);
  public numberOfSeasons = input<number>(0);

  public seasonSelect = output<number>();
  public personClick = output<{ id: number; name: string; profileUrl?: string | null }>();

  public expandedEpisodeIds = signal<Record<number, boolean>>({});

  public getMilestoneBadge(
    ep: TmdbTvEpisodeBaseDto | TmdbTvSeasonEpisodeDto | null | undefined
  ): { label: string; type: 'series-finale' | 'season-finale' | 'mid-season' | 'premiere' } | null {
    if (!ep) return null;

    const epType = ep.episode_type;
    const isEnded = this.showStatus() === 'Ended' || this.showStatus() === 'Canceled';
    const isLastSeason = this.numberOfSeasons() > 0 && ep.season_number >= this.numberOfSeasons();

    if (epType === 'finale') {
      if (isEnded && isLastSeason) {
        return { label: 'SERIES FINALE', type: 'series-finale' };
      }
      return { label: 'SEASON FINALE', type: 'season-finale' };
    }

    if (epType === 'mid_season') {
      return { label: 'MID-SEASON FINALE', type: 'mid-season' };
    }

    if (ep.season_number > 0 && ep.episode_number === 1) {
      if (ep.season_number === 1) {
        return { label: 'SERIES PREMIERE', type: 'premiere' };
      }
      return { label: 'SEASON PREMIERE', type: 'premiere' };
    }

    return null;
  }

  public toggleEpisodeExpand(epId: number): void {
    this.expandedEpisodeIds.update((curr) => ({
      ...curr,
      [epId]: !curr[epId]
    }));
  }

  public openPerson(
    person: { id: number; name: string; profile_path?: string | null },
    knownForDepartment?: string
  ): void {
    const profileUrl = person.profile_path ? resolveMediaImageUrl(person.profile_path, 'w185') : null;
    this.personClick.emit({ id: person.id, name: person.name, profileUrl });
    void this.router.navigate(['/person', person.id], {
      state: {
        preview: {
          id: person.id,
          name: person.name,
          profileUrl,
          knownForDepartment
        }
      }
    });
  }

  public getEpisodeKeyCrew(ep: TmdbTvSeasonEpisodeDto): {
    director: TmdbTvSeasonCrewDto | null;
    writers: TmdbTvSeasonCrewDto[];
  } {
    const director = ep.crew?.find((c) => c.job === 'Director') ?? null;
    const writingJobs = ['Writer', 'Screenplay', 'Teleplay', 'Story'];
    const writers: TmdbTvSeasonCrewDto[] = [];
    const seenIds = new Set<number>();

    for (const c of ep.crew || []) {
      if (
        (c.department === 'Writing' || writingJobs.includes(c.job)) &&
        !seenIds.has(c.id)
      ) {
        seenIds.add(c.id);
        writers.push(c);
        if (writers.length >= 3) break;
      }
    }

    return { director, writers };
  }

  public getTopGuestStars(ep: TmdbTvSeasonEpisodeDto): TmdbTvSeasonGuestStarDto[] {
    const stars = ep.guest_stars || [];
    if (stars.length <= 12) return stars;
    return [...stars]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 12);
  }

  public resolveGuestAvatar(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w185');
  }

  public getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  public resolveStill(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w500');
  }

  public resolvePoster(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w185');
  }
}
