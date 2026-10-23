import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
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
  templateUrl: './watch-providers-panel.component.html',
  styleUrls: ['./watch-providers-panel.component.scss'],
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

  public rentAndBuyProviders = computed<TmdbWatchProviderDto[]>(() => {
    const rent = this.rentProviders();
    const buy = this.buyProviders();
    if (!rent.length || !buy.length) return [];

    const buyIds = new Set(buy.map((b) => b.provider_id));
    const buyNames = new Set(
      buy.map((b) => b.provider_name?.trim().toLowerCase()).filter((n): n is string => Boolean(n))
    );

    const seen = new Set<string | number>();
    const common: TmdbWatchProviderDto[] = [];

    for (const r of rent) {
      const nameKey = r.provider_name?.trim().toLowerCase();
      const isCommon = buyIds.has(r.provider_id) || (nameKey ? buyNames.has(nameKey) : false);
      if (isCommon && !seen.has(r.provider_id)) {
        seen.add(r.provider_id);
        if (nameKey) seen.add(nameKey);
        common.push(r);
      }
    }
    return common;
  });

  public rentOnlyProviders = computed<TmdbWatchProviderDto[]>(() => {
    const rent = this.rentProviders();
    const common = this.rentAndBuyProviders();
    if (!common.length) {
      const seen = new Set<string | number>();
      return rent.filter((r) => {
        if (seen.has(r.provider_id)) return false;
        seen.add(r.provider_id);
        return true;
      });
    }

    const commonIds = new Set(common.map((c) => c.provider_id));
    const commonNames = new Set(
      common.map((c) => c.provider_name?.trim().toLowerCase()).filter((n): n is string => Boolean(n))
    );

    const seen = new Set<string | number>();
    const result: TmdbWatchProviderDto[] = [];

    for (const r of rent) {
      const nameKey = r.provider_name?.trim().toLowerCase();
      const isCommon = commonIds.has(r.provider_id) || (nameKey ? commonNames.has(nameKey) : false);
      if (!isCommon && !seen.has(r.provider_id)) {
        seen.add(r.provider_id);
        if (nameKey) seen.add(nameKey);
        result.push(r);
      }
    }
    return result;
  });

  public buyOnlyProviders = computed<TmdbWatchProviderDto[]>(() => {
    const buy = this.buyProviders();
    const common = this.rentAndBuyProviders();
    if (!common.length) {
      const seen = new Set<string | number>();
      return buy.filter((b) => {
        if (seen.has(b.provider_id)) return false;
        seen.add(b.provider_id);
        return true;
      });
    }

    const commonIds = new Set(common.map((c) => c.provider_id));
    const commonNames = new Set(
      common.map((c) => c.provider_name?.trim().toLowerCase()).filter((n): n is string => Boolean(n))
    );

    const seen = new Set<string | number>();
    const result: TmdbWatchProviderDto[] = [];

    for (const b of buy) {
      const nameKey = b.provider_name?.trim().toLowerCase();
      const isCommon = commonIds.has(b.provider_id) || (nameKey ? commonNames.has(nameKey) : false);
      if (!isCommon && !seen.has(b.provider_id)) {
        seen.add(b.provider_id);
        if (nameKey) seen.add(nameKey);
        result.push(b);
      }
    }
    return result;
  });

  public resolveLogo(path: string | null | undefined): string {
    return resolveMediaImageUrl(path, 'w185');
  }
}
