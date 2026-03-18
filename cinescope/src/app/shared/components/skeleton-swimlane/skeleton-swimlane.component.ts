import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-skeleton-swimlane',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './skeleton-swimlane.component.html',
    styleUrls: ['./skeleton-swimlane.component.scss']
})
export class SkeletonSwimlaneComponent { }