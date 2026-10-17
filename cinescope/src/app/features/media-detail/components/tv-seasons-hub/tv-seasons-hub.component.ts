import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonSpinner } from '@ionic/angular/standalone';
import { TmdbTvEpisodeBaseDto, TmdbTvSeasonBaseDto } from '../../../../core/dtos/tv/tv-detail.dto';
import { TmdbTvSeasonDetailDto, TmdbTvSeasonEpisodeDto } from '../../../../core/dtos/tv-seasons/tv-season-detail.dto';
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
            <div class="pulse-card upcoming">
              <div class="pulse-badge">NEXT EPISODE</div>
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
            <div class="pulse-card latest">
              <div class="pulse-badge muted">LATEST AIRED</div>
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
                    @if (ep.episode_type === 'finale') {
                      <span class="ep-finale-badge">FINALE</span>
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

                    @if (getEpisodeDirector(ep); as director) {
                      <div class="episode-crew-line">Directed by {{ director }}</div>
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

                @if (ep.guest_stars && ep.guest_stars.length > 0 && expandedEpisodeIds()[ep.id]) {
                  <div class="guest-stars-line">
                    <span class="gs-label">Guest Stars:</span>
                    <span>{{ formatGuestStars(ep) }}</span>
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
    :host {
      display: block;
    }
    .detail-section {
      padding: 20px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .section-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .section-heading {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
    }
    .section-header-row .section-heading {
      margin-bottom: 0;
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
    }
    .pulse-card.upcoming {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(16, 185, 129, 0.08));
      border-color: rgba(99, 102, 241, 0.4);
    }
    .pulse-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.8px;
      padding: 2px 7px;
      border-radius: 4px;
      background: #6366f1;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .pulse-badge.muted {
      background: rgba(255, 255, 255, 0.14);
      color: rgba(255, 255, 255, 0.85);
    }
    .pulse-title {
      font-size: 14.5px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .pulse-meta {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      display: flex;
      gap: 6px;
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
    }
    .season-tabs-scroll::-webkit-scrollbar {
      display: none;
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
      transition: all 0.15s ease;
    }
    .season-tab-card.active {
      background: rgba(229, 9, 20, 0.22);
      border-color: var(--ion-color-primary, #e50914);
      color: #ffffff;
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
    }
    .episode-still {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ep-number-badge {
      position: absolute;
      bottom: 4px;
      left: 4px;
      background: rgba(0, 0, 0, 0.78);
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .ep-finale-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      background: #f59e0b;
      color: #000000;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
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
      color: #ffffff;
      line-height: 1.3;
    }
    .episode-rating {
      flex-shrink: 0;
      font-size: 11.5px;
      font-weight: 700;
      color: #fbbf24;
    }
    .episode-submeta {
      margin-top: 3px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.54);
      display: flex;
      gap: 5px;
    }
    .episode-crew-line {
      margin-top: 4px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.65);
      font-style: italic;
    }
    .episode-synopsis {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.48;
      color: rgba(255, 255, 255, 0.78);
    }
    .episode-synopsis.clamped {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
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
    .guest-stars-line {
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.65);
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .gs-label {
      font-weight: 700;
      color: rgba(255, 255, 255, 0.85);
      margin-right: 4px;
    }
  `]
})
export class TvSeasonsHubComponent {
  public seasons = input.required<TmdbTvSeasonBaseDto[]>();
  public selectedSeasonNumber = input.required<number>();
  public activeSeasonDetail = input<TmdbTvSeasonDetailDto | null>(null);
  public episodes = input<TmdbTvSeasonEpisodeDto[]>([]);
  public isSeasonLoading = input<boolean>(false);
  public lastEpisodeToAir = input<TmdbTvEpisodeBaseDto | null>(null);
  public nextEpisodeToAir = input<TmdbTvEpisodeBaseDto | null>(null);

  public seasonSelect = output<number>();

  public expandedEpisodeIds = signal<Record<number, boolean>>({});

  public toggleEpisodeExpand(epId: number): void {
    this.expandedEpisodeIds.update((curr) => ({
      ...curr,
      [epId]: !curr[epId]
    }));
  }

  public getEpisodeDirector(ep: TmdbTvSeasonEpisodeDto): string | null {
    const dir = ep.crew?.find((c) => c.job === 'Director');
    return dir ? dir.name : null;
  }

  public formatGuestStars(ep: TmdbTvSeasonEpisodeDto): string {
    return (ep.guest_stars || [])
      .slice(0, 5)
      .map((g) => (g.character ? `${g.name} (${g.character})` : g.name))
      .join(', ');
  }

  public resolveStill(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w500');
  }

  public resolvePoster(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w185');
  }
}
