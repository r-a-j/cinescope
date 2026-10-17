import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { TmdbWatchProviderDto } from '../../../../core/dtos/watch-providers/watch-provider.dto';
import { TmdbTvNetworkDto } from '../../../../core/dtos/tv/tv-detail.dto';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';

@Component({
  selector: 'app-watch-providers-panel',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="watch-providers-section">
      <div class="section-header-row">
        <h3 class="section-heading">WHERE TO WATCH</h3>
        @if (availableRegions().length > 1) {
          <div class="region-selector">
            @for (reg of availableRegions(); track reg) {
              <button
                type="button"
                class="region-chip"
                [class.active]="selectedRegion() === reg"
                (click)="regionChange.emit(reg)">
                {{ reg }}
              </button>
            }
          </div>
        }
      </div>

      @if (tvNetworks().length > 0) {
        <div class="provider-tier">
          <span class="tier-label">Original Network</span>
          <div class="provider-pills-row">
            @for (net of tvNetworks(); track net.id) {
              <div class="network-pill">
                @if (net.logo_path) {
                  <img [src]="resolveLogo(net.logo_path)" [alt]="net.name" class="network-logo" />
                }
                <span>{{ net.name }}</span>
              </div>
            }
          </div>
        </div>
      }

      @if (streamingProviders().length > 0) {
        <div class="provider-tier">
          <span class="tier-label stream-badge">STREAM</span>
          <div class="provider-pills-row">
            @for (prov of streamingProviders(); track prov.provider_id) {
              <div class="provider-chip">
                <img [src]="resolveLogo(prov.logo_path)" [alt]="prov.provider_name" class="provider-icon" />
                <span>{{ prov.provider_name }}</span>
              </div>
            }
          </div>
        </div>
      }

      @if (rentProviders().length > 0) {
        <div class="provider-tier">
          <span class="tier-label rent-badge">RENT</span>
          <div class="provider-pills-row">
            @for (prov of rentProviders(); track prov.provider_id) {
              <div class="provider-chip">
                <img [src]="resolveLogo(prov.logo_path)" [alt]="prov.provider_name" class="provider-icon" />
                <span>{{ prov.provider_name }}</span>
              </div>
            }
          </div>
        </div>
      }

      @if (buyProviders().length > 0) {
        <div class="provider-tier">
          <span class="tier-label buy-badge">BUY</span>
          <div class="provider-pills-row">
            @for (prov of buyProviders(); track prov.provider_id) {
              <div class="provider-chip">
                <img [src]="resolveLogo(prov.logo_path)" [alt]="prov.provider_name" class="provider-icon" />
                <span>{{ prov.provider_name }}</span>
              </div>
            }
          </div>
        </div>
      }

      @if (justWatchLink(); as jwLink) {
        <div class="justwatch-footer">
          <span>Streaming availability powered by JustWatch</span>
          <a [href]="jwLink" target="_blank" rel="noopener noreferrer" class="jw-link">
            Open Watch Links <ion-icon name="open-outline"></ion-icon>
          </a>
        </div>
      }
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .watch-providers-section {
      padding: 20px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .section-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .section-heading {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
    }
    .region-selector {
      display: flex;
      gap: 6px;
      overflow-x: auto;
    }
    .region-chip {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.75);
      border-radius: 6px;
      padding: 4px 9px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }
    .region-chip.active {
      background: var(--ion-color-primary, #e50914);
      border-color: var(--ion-color-primary, #e50914);
      color: #ffffff;
    }
    .provider-tier {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .tier-label {
      display: inline-block;
      align-self: flex-start;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.8px;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.85);
    }
    .tier-label.stream-badge {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
    }
    .tier-label.rent-badge {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }
    .tier-label.buy-badge {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }
    .provider-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .provider-chip,
    .network-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px 6px 6px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      color: #ffffff;
    }
    .provider-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      object-fit: cover;
    }
    .network-logo {
      height: 18px;
      max-width: 64px;
      object-fit: contain;
      background: rgba(255, 255, 255, 0.92);
      padding: 2px 5px;
      border-radius: 4px;
    }
    .justwatch-footer {
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.45);
    }
    .justwatch-footer .jw-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #fbbf24;
      text-decoration: none;
      font-weight: 600;
    }
  `]
})
export class WatchProvidersPanelComponent {
  public availableRegions = input.required<string[]>();
  public selectedRegion = input.required<string>();
  public tvNetworks = input<TmdbTvNetworkDto[]>([]);
  public streamingProviders = input<TmdbWatchProviderDto[]>([]);
  public rentProviders = input<TmdbWatchProviderDto[]>([]);
  public buyProviders = input<TmdbWatchProviderDto[]>([]);
  public justWatchLink = input<string | null>(null);

  public regionChange = output<string>();

  public resolveLogo(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w185');
  }
}
