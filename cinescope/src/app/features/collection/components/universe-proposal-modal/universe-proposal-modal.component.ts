import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sparkles, closeOutline, checkmarkCircle, albumsOutline, checkmarkSharp } from 'ionicons/icons';

@Component({
  selector: 'app-universe-proposal-modal',
  standalone: true,
  imports: [CommonModule, IonIcon],
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

  @Output() confirmAscend = new EventEmitter<{ foldSubCollection: boolean }>();
  @Output() dismiss = new EventEmitter<void>();

  public foldSubCollection = signal<boolean>(true);
  public dragOffsetY = signal<number>(0);
  public isDragging = signal<boolean>(false);
  private touchStartY = 0;
  private touchStartTime = 0;

  constructor() {
    addIcons({ sparkles, closeOutline, checkmarkCircle, albumsOutline, checkmarkSharp });
  }

  public toggleFold(): void {
    this.foldSubCollection.update((v) => !v);
  }

  public onConfirm(): void {
    this.confirmAscend.emit({ foldSubCollection: this.foldSubCollection() });
  }

  public onDismiss(): void {
    this.dismiss.emit();
  }

  public onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    if (!touch) return;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    this.isDragging.set(true);
  }

  public onTouchMove(event: TouchEvent): void {
    if (!this.isDragging()) return;
    const touch = event.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - this.touchStartY;
    if (deltaY > 0) {
      this.dragOffsetY.set(deltaY);
    } else {
      this.dragOffsetY.set(0);
    }
  }

  public onTouchEnd(): void {
    if (!this.isDragging()) return;
    const offset = this.dragOffsetY();
    const elapsed = Math.max(1, Date.now() - this.touchStartTime);
    const velocity = offset / elapsed; // px per ms

    this.isDragging.set(false);

    if (offset > 75 || (offset > 30 && velocity > 0.45)) {
      this.dragOffsetY.set(0);
      this.onDismiss();
    } else {
      this.dragOffsetY.set(0);
    }
  }
}
