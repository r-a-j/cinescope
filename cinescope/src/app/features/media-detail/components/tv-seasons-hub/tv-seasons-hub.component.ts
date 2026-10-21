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
  template: `
    <!-- TV-EXCLUSIVE: NEXT / LAST EPISODE TRACKER ("Where Was I?") -->
    @if (nextEpisodeToAir() || lastEpisodeToAir()) {
      <section class="detail-section episode-pulse-section">
        <h3 class="section-heading">AIRING PULSE</h3>
        <div class="episode-pulse-grid">
          @if (nextEpisodeToAir(); as nextEp) {
            <div class="pulse-card upcoming" [class.is-finale]="nextEp.episode_type === 'finale'">
              <div class="pulse-badges-group">
                <span class="pulse-badge">NEXT EPISODE</span>
                @if (getMilestoneBadge(nextEp); as milestone) {
                  <span class="milestone-badge" [class]="'milestone-' + milestone.type">
                    {{ milestone.label }}
                  </span>
                }
              </div>
              <div class="pulse-title">
                S{{ nextEp.season_number }} • E{{ nextEp.episode_number }} — {{ nextEp.name }}
              </div>
              <div class="pulse-meta">
                <span>Airs {{ nextEp.air_date || 'TBA' }}</span>
                @if (nextEp.runtime) {
                  <span>• {{ nextEp.runtime }}m</span>
                }
              </div>
              @if (nextEp.overview) {
                <p class="pulse-overview">{{ nextEp.overview }}</p>
              }
            </div>
          }

          @if (lastEpisodeToAir(); as lastEp) {
            <div class="pulse-card latest" [class.is-finale]="lastEp.episode_type === 'finale'">
              <div class="pulse-badges-group">
                <span class="pulse-badge muted">LATEST AIRED</span>
                @if (getMilestoneBadge(lastEp); as milestone) {
                  <span class="milestone-badge" [class]="'milestone-' + milestone.type">
                    {{ milestone.label }}
                  </span>
                }
              </div>
              <div class="pulse-title">
                S{{ lastEp.season_number }} • E{{ lastEp.episode_number }} — {{ lastEp.name }}
              </div>
              <div class="pulse-meta">
                <span>Aired {{ lastEp.air_date }}</span>
                @if (lastEp.runtime) {
                  <span>• {{ lastEp.runtime }}m</span>
                }
                @if (lastEp.vote_average > 0) {
                  <span>• ★ {{ lastEp.vote_average.toFixed(1) }}</span>
                }
              </div>
              @if (lastEp.overview) {
                <p class="pulse-overview">{{ lastEp.overview }}</p>
              }
            </div>
          }
        </div>
      </section>
    }

    <!-- TV-EXCLUSIVE: INTERACTIVE SEASONS & EPISODES EXPLORER -->
    @if (seasons().length > 0) {
      <section class="detail-section seasons-hub-section">
        <div class="section-header-row">
          <h3 class="section-heading">SEASONS & EPISODES ({{ seasons().length }})</h3>
        </div>

        <!-- Horizontal Season Selector Cards with Season Poster Thumbnail -->
        <div class="season-tabs-scroll">
          @for (season of seasons(); track season.id) {
            <button
              type="button"
              class="season-tab-card"
              [class.active]="selectedSeasonNumber() === season.season_number"
              (click)="seasonSelect.emit(season.season_number)">
              @if (season.poster_path) {
                <img
                  [src]="resolvePoster(season.poster_path)"
                  [alt]="season.name"
                  class="season-mini-poster"
                  loading="lazy" />
              }
              <div class="season-tab-content">
                <div class="season-tab-title">{{ season.name }}</div>
                <div class="season-tab-meta">
                  <span>{{ season.episode_count }} Eps</span>
                  @if (season.air_date) {
                    <span>• {{ season.air_date.slice(0, 4) }}</span>
                  }
                  @if (season.vote_average > 0) {
                    <span>• ★ {{ season.vote_average.toFixed(1) }}</span>
                  }
                </div>
              </div>
            </button>
          }
        </div>

        <!-- Selected Season Episode List -->
        @if (isSeasonLoading()) {
          <div class="season-loading">
            <ion-spinner name="crescent" color="primary"></ion-spinner>
            <span>Loading episodes...</span>
          </div>
        } @else if (episodes().length > 0) {
          @if (activeSeasonDetail()?.overview) {
            <p class="season-overview-box">{{ activeSeasonDetail()?.overview }}</p>
          }

          <div class="episodes-list">
            @for (ep of episodes(); track ep.id) {
              <div class="episode-card" [class.is-finale]="ep.episode_type === 'finale'">
                <div class="episode-top-row">
                  <div class="episode-still-wrapper">
                    <img
                      [src]="resolveStill(ep.still_path)"
                      [alt]="ep.name"
                      class="episode-still"
                      loading="lazy"
                      decoding="async" />
                    <span class="ep-number-badge">E{{ ep.episode_number }}</span>
                    @if (getMilestoneBadge(ep); as milestone) {
                      <span class="ep-milestone-badge" [class]="'milestone-' + milestone.type">
                        {{ milestone.label }}
                      </span>
                    }
                  </div>

                  <div class="episode-info">
                    <div class="episode-title-row">
                      <h4 class="episode-name">{{ ep.name }}</h4>
                      @if (ep.vote_average > 0) {
                        <span class="episode-rating">★ {{ ep.vote_average.toFixed(1) }}</span>
                      }
                    </div>

                    <div class="episode-submeta">
                      @if (ep.air_date) {
                        <span>{{ ep.air_date }}</span>
                      }
                      @if (ep.runtime) {
                        <span>• {{ ep.runtime }}m</span>
                      }
                    </div>

                    @if (getEpisodeKeyCrew(ep); as keyCrew) {
                      <div class="episode-crew-line">
                        @if (keyCrew.director) {
                          <span class="crew-role-label">Dir</span>
                          <button
                            type="button"
                            class="crew-person-btn"
                            [attr.aria-label]="'View director ' + keyCrew.director.name"
                            (click)="openPerson(keyCrew.director, 'Directing')">
                            {{ keyCrew.director.name }}
                          </button>
                        }
                        @if (keyCrew.writers.length > 0) {
                          @if (keyCrew.director) {
                            <span class="crew-dot">•</span>
                          }
                          <span class="crew-role-label">Writ</span>
                          @for (w of keyCrew.writers; track w.id; let last = $last) {
                            <button
                              type="button"
                              class="crew-person-btn"
                              [attr.aria-label]="'View writer ' + w.name"
                              (click)="openPerson(w, 'Writing')">
                              {{ w.name }}
                            </button>
                            @if (!last) {
                              <span class="comma">, </span>
                            }
                          }
                        }
                      </div>
                    }
                  </div>
                </div>

                @if (ep.overview) {
                  <p
                    class="episode-synopsis"
                    [class.clamped]="!expandedEpisodeIds()[ep.id] && ep.overview.length > 180">
                    {{ ep.overview }}
                  </p>
                  @if (ep.overview.length > 180) {
                    <button
                      type="button"
                      class="ep-expand-btn"
                      (click)="toggleEpisodeExpand(ep.id)">
                      {{ expandedEpisodeIds()[ep.id] ? 'Show less' : 'More details' }}
                    </button>
                  }
                }

                @if (ep.guest_stars && ep.guest_stars.length > 0) {
                  <div class="episode-guest-stars-section">
                    <span class="gs-title">GUEST STARS ({{ ep.guest_stars.length }})</span>
                    <div class="guest-stars-scroll">
                      @for (star of getTopGuestStars(ep); track star.id) {
                        <div
                          class="guest-star-pill"
                          role="button"
                          tabindex="0"
                          [attr.aria-label]="star.name + (star.character ? ' as ' + star.character : '')"
                          (click)="openPerson(star, 'Acting')"
                          (keyup.enter)="openPerson(star, 'Acting')">
                          <div class="guest-avatar-wrap">
                            @if (star.profile_path) {
                              <img
                                [src]="resolveGuestAvatar(star.profile_path)"
                                [alt]="star.name"
                                class="guest-avatar"
                                loading="lazy" />
                            } @else {
                              <div class="guest-avatar-fallback">{{ getInitials(star.name) }}</div>
                            }
                          </div>
                          <div class="guest-details">
                            <span class="guest-name">{{ star.name }}</span>
                            @if (star.character) {
                              <span class="guest-character">{{ star.character }}</span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .detail-section {
      padding: 20px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .section-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      .section-heading { margin-bottom: 0; }
    }
    .section-heading {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
    }
    .episode-pulse-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .pulse-card {
      padding: 14px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.09);
      &.upcoming {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(16, 185, 129, 0.08));
        border-color: rgba(99, 102, 241, 0.4);
      }
      &.is-finale { border-color: rgba(245, 158, 11, 0.4); }
    }
    .pulse-badges-group {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .pulse-badge {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
      background: #6366f1;
      color: #fff;
      &.muted {
        background: rgba(255, 255, 255, 0.14);
        color: rgba(255, 255, 255, 0.85);
      }
    }
    .milestone-badge {
      display: inline-flex;
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .milestone-series-finale { background: #f59e0b; color: #000; }
    .milestone-season-finale { background: #e50914; color: #fff; }
    .milestone-mid-season { background: #8b5cf6; color: #fff; }
    .milestone-premiere { background: #10b981; color: #fff; }
    .pulse-title {
      font-size: 14.5px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .pulse-meta, .episode-submeta {
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.58);
      display: flex;
      gap: 5px;
    }
    .pulse-overview {
      margin: 8px 0 0;
      font-size: 12.5px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.78);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .season-tabs-scroll {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 8px;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }
    .season-tab-card {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      &.active {
        background: rgba(229, 9, 20, 0.22);
        border-color: var(--ion-color-primary, #e50914);
        color: #fff;
      }
    }
    .season-mini-poster {
      width: 34px;
      height: 50px;
      border-radius: 5px;
      object-fit: cover;
    }
    .season-tab-title {
      font-size: 13.5px;
      font-weight: 700;
    }
    .season-tab-meta {
      margin-top: 3px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.58);
      display: flex;
      gap: 4px;
    }
    .season-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 28px 0;
      color: rgba(255, 255, 255, 0.65);
      font-size: 13px;
    }
    .season-overview-box {
      margin: 12px 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      font-size: 13px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.78);
    }
    .episodes-list {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 540px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .episode-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 11px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.07);
    }
    .episode-card.is-finale {
      border-color: rgba(245, 158, 11, 0.45);
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(255, 255, 255, 0.03));
    }
    .episode-top-row {
      display: flex;
      gap: 12px;
    }
    .episode-still-wrapper {
      position: relative;
      width: 118px;
      min-width: 118px;
      height: 70px;
      border-radius: 8px;
      overflow: hidden;
      background: #141418;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .ep-number-badge {
      position: absolute;
      bottom: 4px;
      left: 4px;
      background: rgba(0, 0, 0, 0.78);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .ep-milestone-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 8px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .episode-info {
      flex: 1;
      min-width: 0;
    }
    .episode-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .episode-name {
      margin: 0;
      font-size: 13.5px;
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
    }
    .episode-rating {
      flex-shrink: 0;
      font-size: 11.5px;
      font-weight: 700;
      color: #fbbf24;
    }
    .episode-crew-line {
      margin-top: 4px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.65);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 3px 5px;
      line-height: 1.35;
    }
    .crew-role-label {
      font-weight: 700;
      font-size: 9.5px;
      color: rgba(255, 255, 255, 0.45);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .crew-person-btn {
      background: none;
      border: none;
      padding: 0;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      &:active { color: var(--ion-color-primary, #e50914); }
    }
    .crew-dot {
      color: rgba(255, 255, 255, 0.3);
      font-size: 9px;
      margin: 0 1px;
    }
    .comma {
      color: rgba(255, 255, 255, 0.5);
      margin-right: 2px;
    }
    .episode-synopsis {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.48;
      color: rgba(255, 255, 255, 0.78);
      &.clamped {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
    .ep-expand-btn {
      align-self: flex-start;
      background: none;
      border: none;
      padding: 0;
      color: var(--ion-color-primary, #e50914);
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
    }
    .episode-guest-stars-section {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .gs-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.6px;
      color: rgba(255, 255, 255, 0.48);
      text-transform: uppercase;
      margin-bottom: 6px;
      display: block;
    }
    .guest-stars-scroll {
      display: flex;
      align-items: center;
      gap: 7px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 2px;
      &::-webkit-scrollbar { display: none; }
    }
    .guest-star-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 20px;
      padding: 3px 9px 3px 3px;
      cursor: pointer;
      flex-shrink: 0;
      &:active {
        transform: scale(0.96);
        background: rgba(255, 255, 255, 0.1);
      }
    }
    .guest-avatar-wrap {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
      img { width: 100%; height: 100%; object-fit: cover; display: block; }
    }
    .guest-avatar-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.75);
      background: rgba(255, 255, 255, 0.12);
    }
    .guest-details {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .guest-name {
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
    }
    .guest-character {
      font-size: 9.5px;
      color: rgba(255, 255, 255, 0.5);
      white-space: nowrap;
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
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
