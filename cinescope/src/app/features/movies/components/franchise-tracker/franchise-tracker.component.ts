import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonProgressBar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { albumsOutline, chevronForwardOutline } from 'ionicons/icons';
import { FranchiseCollectionSummary } from '../../../../core/models/franchise.model';

@Component({
  selector: 'app-franchise-tracker',
  standalone: true,
  imports: [CommonModule, IonIcon, IonProgressBar],
  templateUrl: './franchise-tracker.component.html',
  styleUrls: ['./franchise-tracker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FranchiseTrackerComponent {
  public activeFranchises = input.required<FranchiseCollectionSummary[]>();
  public collectionClick = output<{ id: number | string; name: string }>();

  constructor() {
    addIcons({
      albumsOutline,
      chevronForwardOutline
    });
  }

  public onSelectCollection(id: number | string, name: string): void {
    this.collectionClick.emit({ id, name });
  }

  public progressLabel(franchise: FranchiseCollectionSummary): string {
    if (franchise.upNextPart) {
      return `${franchise.watchedCount > 0 ? 'Next' : 'Start'}: ${franchise.upNextPart.title}`;
    }

    if (franchise.completionPercentage >= 100 && (franchise.upcomingPartsCount ?? 0) > 0) {
      const count = franchise.upcomingPartsCount ?? 0;
      return `Caught up · ${count} upcoming`;
    }

    if (franchise.watchlistCount > 0) {
      return `${franchise.watchlistCount} in your watchlist`;
    }

    if (franchise.releasedPartsCount === 0 && (franchise.upcomingPartsCount ?? 0) > 0) {
      return `${franchise.upcomingPartsCount} upcoming`;
    }

    return `${Math.max(0, franchise.totalParts - franchise.watchedCount)} released to watch`;
  }
}
