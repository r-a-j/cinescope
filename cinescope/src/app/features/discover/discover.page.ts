import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';


@Component({
    selector: 'app-discover',
    standalone: true,
    imports: [
        CommonModule,
        IonicModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './discover.page.html',
    styleUrls: ['./discover.page.scss'],
})
export class DiscoverPage { }