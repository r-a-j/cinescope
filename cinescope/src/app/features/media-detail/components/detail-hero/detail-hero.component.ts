import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, homeOutline, shareSocialOutline, star, playCircleOutline } from 'ionicons/icons';
import { BookmarkState } from '../../../../shared/components/poster-card/poster-card.component';
import { TmdbTvNetworkDto } from '../../../../core/dtos/tv/tv-detail.dto';
import { resolveMediaImageUrl } from '../../../../core/constants/api.constants';
import { OriginCountryVm, ProductionStatusVm } from '../../media-detail.page';

@Component({
  selector: 'app-detail-hero',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail-hero.component.html',
  styleUrls: ['./detail-hero.component.scss'],
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
  public productionStatus = input<ProductionStatusVm | null>(null);
  public ratingValue = input<string | null>(null);
  public voteCountLabel = input<string | null>(null);
  public releaseYearLabel = input<string>('');
  public runtimeLabel = input<string | null>(null);
  public genres = input<string[]>([]);
  public networks = input<TmdbTvNetworkDto[]>([]);
  public originCountry = input<OriginCountryVm | null>(null);
  public hasTrailer = input<boolean>(false);
  public isScrolled = input<boolean>(false);

  public backClick = output();
  public homeClick = output();
  public shareClick = output();
  public watchlistToggle = output();
  public watchedToggle = output();
  public trailerClick = output();

  public isBackdropLoaded = signal<boolean>(false);

  constructor() {
    addIcons({arrowBackOutline,homeOutline,shareSocialOutline,star,playCircleOutline});
    effect(() => {
      const url = this.backdropUrl();
      this.isBackdropLoaded.set(!url);
    });
  }

  public onBackdropLoad(): void {
    this.isBackdropLoaded.set(true);
  }

  public resolveNetworkLogo(path: string | null): string | null {
    return path ? resolveMediaImageUrl(path, 'w185') : null;
  }
}
