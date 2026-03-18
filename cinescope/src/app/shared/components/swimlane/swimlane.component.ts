import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PosterCardComponent } from '../poster-card/poster-card.component';
import { SwimlaneItem } from '../../models/swimlane-item.interface';

@Component({
    selector: 'app-swimlane',
    standalone: true,
    imports: [CommonModule, PosterCardComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './swimlane.component.html',
    styleUrls: ['./swimlane.component.scss']
})
export class SwimlaneComponent {
    public title = input.required<string>();

    // We will type this properly when we wire the TMDB API. 
    // For now, it accepts an array of any dummy objects.
    public items = input.required<SwimlaneItem[]>();
}