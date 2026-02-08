import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { InfiniteScrollCustomEvent, IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonButton } from '@ionic/angular/standalone';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { MediaListComponent } from '../../shared/components/media-list/media-list.component';
import { Observable } from 'rxjs'; // Import Observable

@Component({
    selector: 'app-generic-discover',
    templateUrl: './generic-discover.page.html',
    styleUrls: ['./generic-discover.page.scss'],
    standalone: true,
    imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonButton, CommonModule, MediaListComponent]
})
export class GenericDiscoverPage implements OnInit {
    title: string = 'Discover';
    items: any[] = [];
    type: 'movie' | 'tv' = 'movie';
    categoryMethod: string = '';
    currentPage: number = 1;
    isLoading: boolean = false;

    constructor(
        private route: ActivatedRoute,
        private tmdbService: TmdbSearchService,
        private location: Location
    ) { }

    ngOnInit() {
        this.route.data.subscribe(data => {
            this.title = data['title'] || 'Discover';
            this.type = data['type'] || 'movie';
            this.categoryMethod = data['method'];
            this.items = []; // Clear on route change
            this.currentPage = 1;
            this.loadData();
        });
    }

    loadData(event?: InfiniteScrollCustomEvent) {
        if (!this.categoryMethod) {
            console.error('No category method specified for GenericDiscoverPage');
            event?.target.complete();
            return;
        }

        this.isLoading = true;

        // Dynamic service call
        const serviceCall = (this.tmdbService as any)[this.categoryMethod](this.currentPage);

        if (serviceCall instanceof Observable) { // Ensure it's an observable
            serviceCall.subscribe({
                next: (response: any) => {
                    if (response && response.results) {
                        this.items = [...this.items, ...response.results];
                        this.currentPage++;
                    }
                    this.isLoading = false;
                    event?.target.complete();
                },
                error: (err: any) => {
                    console.error('Error loading data:', err);
                    this.isLoading = false;
                    event?.target.complete();
                }
            });
        } else {
            console.error(`Method ${this.categoryMethod} does not return an Observable or does not exist on TmdbSearchService`);
            this.isLoading = false;
            event?.target.complete();
        }
    }

    goBack() {
        this.location.back();
    }
}
