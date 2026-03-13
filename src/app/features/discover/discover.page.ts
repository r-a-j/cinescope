import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { HeroBannerComponent } from '../../shared/components/hero-banner/hero-banner.component';
import { SwimlaneComponent } from '../../shared/components/swimlane/swimlane.component';
import { SwimlaneItem } from 'src/app/shared/models/swimlane-item.interface';

@Component({
    selector: 'app-discover',
    standalone: true,
    imports: [IonContent, HeaderComponent, HeroBannerComponent, SwimlaneComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './discover.page.html',
    styleUrls: ['./discover.page.scss'],
})
export class DiscoverPage {

    // ToDo: Remove dummy data to test the horizontal scrolling
    public dummyMovies: SwimlaneItem[] = [
        {
            id: 1,
            title: 'Prem Pujari',
            posterUrl: 'assets/placeholders/placeholder.png',
            bookmarkState: 'none'
        },
        {
            id: 2,
            title: 'The Night of Life',
            posterUrl: 'assets/placeholders/placeholder.png',
            bookmarkState: 'watchlist' // Should show the Red SVG
        },
        {
            id: 3,
            title: 'Manque',
            posterUrl: 'assets/placeholders/placeholder.png',
            bookmarkState: 'watched' // Should show the Teal SVG
        },
        {
            id: 4,
            title: 'Shatak',
            posterUrl: 'assets/placeholders/placeholder.png',
            bookmarkState: 'none'
        },
        {
            id: 5,
            title: 'Another Hit',
            posterUrl: 'assets/placeholders/placeholder.png',
            bookmarkState: 'watchlist'
        }
    ];
}