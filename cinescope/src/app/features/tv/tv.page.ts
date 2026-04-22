import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';


@Component({
    selector: 'app-tv',
    standalone: true,
    imports: [
        CommonModule,
        IonicModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tv.page.html',
    styleUrls: ['./tv.page.scss'],
})
export class TvPage { }
