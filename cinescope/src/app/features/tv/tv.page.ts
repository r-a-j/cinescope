import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
    selector: 'app-tv',
    standalone: true,
    imports: [
        CommonModule,
        IonicModule,
        HeaderComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tv.page.html',
    styleUrls: ['./tv.page.scss'],
})
export class TvPage { }
