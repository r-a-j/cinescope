import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'primary' | 'gold' | 'outline' | 'danger' | 'dark';

@Component({
    selector: 'app-badge',
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './badge.component.html',
    styleUrls: ['./badge.component.scss']
})
export class BadgeComponent {
    // Using Angular 21 required signals
    public text = input.required<string>();
    public variant = input<BadgeVariant>('primary');
    public iconUrl = input<string>();
}