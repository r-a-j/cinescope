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
}
