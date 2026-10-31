import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  filmOutline,
  tvOutline,
  bookmarkOutline,
  checkmarkDoneCircleOutline,
  albumsOutline,
  trophyOutline,
  heartOutline,
  mailOpenOutline,
  sparkles,
  sparklesOutline,
  searchOutline,
  optionsOutline,
  refreshOutline,
  compassOutline
} from 'ionicons/icons';

export type EmptyStateActionVariant = 'primary' | 'secondary';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss']
})
export class EmptyStateComponent {
  public readonly icon = input.required<string>();
  public readonly kicker = input<string | undefined>(undefined);
  public readonly title = input.required<string>();
  public readonly description = input.required<string>();
  public readonly actionLabel = input<string | undefined>(undefined);
  public readonly actionIcon = input<string | undefined>(undefined);
  public readonly actionVariant = input<EmptyStateActionVariant>('primary');
  public readonly compact = input<boolean>(false);

  public readonly actionClick = output();

  constructor() {
    addIcons({
      filmOutline,
      tvOutline,
      bookmarkOutline,
      checkmarkDoneCircleOutline,
      albumsOutline,
      trophyOutline,
      heartOutline,
      mailOpenOutline,
      sparkles,
      sparklesOutline,
      searchOutline,
      optionsOutline,
      refreshOutline,
      compassOutline
    });
  }

  public onAction(): void {
    this.actionClick.emit();
  }
}
