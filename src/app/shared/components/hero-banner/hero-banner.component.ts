import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeComponent } from '../badge/badge.component';

@Component({
    selector: 'app-hero-banner',
    standalone: true,
    imports: [CommonModule, BadgeComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './hero-banner.component.html',
    styleUrls: ['./hero-banner.component.scss']
})
export class HeroBannerComponent {
    // Hardcoded for the scaffolding phase. We will make this dynamic later.
}