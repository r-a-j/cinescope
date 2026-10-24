import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sparkles, closeOutline, checkmarkCircle, albumsOutline } from 'ionicons/icons';

@Component({
  selector: 'app-universe-proposal-modal',
  standalone: true,
  imports: [CommonModule, IonIcon, IonSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './universe-proposal-modal.component.html',
  styleUrls: ['./universe-proposal-modal.component.scss']
})
export class UniverseProposalModalComponent {
  @Input({ required: true }) universeTitle!: string;
  @Input() connectionInsight?: string | undefined;
  @Input() canonCount = 0;
  @Input() siblingFranchises?: { id: number; name: string }[] | undefined;
  @Input() isResolving = false;

  @Output() confirmAscend = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  constructor() {
    addIcons({ sparkles, closeOutline, checkmarkCircle, albumsOutline });
  }

  public onConfirm(): void {
    if (this.isResolving) return;
    this.confirmAscend.emit();
  }

  public onDismiss(): void {
    if (this.isResolving) return;
    this.dismiss.emit();
  }
}
