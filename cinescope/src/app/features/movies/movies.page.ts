import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';


@Component({
    selector: 'app-movies',
    standalone: true,
    imports: [
        CommonModule,
        IonicModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './movies.page.html',
    styleUrls: ['./movies.page.scss'],
})
export class MoviesPage { }
