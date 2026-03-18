import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import { star } from 'ionicons/icons';

export type BadgeVariant = 'primary' | 'gold' | 'outline' | 'danger' | 'dark';

@Component({
    selector: 'app-badge',
    standalone: true,
    imports: [IonIcon, CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './badge.component.html',
    styleUrls: ['./badge.component.scss']
})
export class BadgeComponent {
    public text = input.required<string>();
    public variant = input<BadgeVariant>('primary');
    public iconUrl = input<string>();

    // NEW: Input for standard Ionic icons
    public icon = input<string>();

    constructor() {
        // Register the star icon so it works in the standalone component
        addIcons({ star });
    }
}