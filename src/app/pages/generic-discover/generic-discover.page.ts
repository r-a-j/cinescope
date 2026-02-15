import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import {
    InfiniteScrollCustomEvent,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton
} from '@ionic/angular/standalone';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { MediaListComponent } from '../../shared/components/media-list/media-list.component';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-generic-discover',
    templateUrl: './generic-discover.page.html',
    styleUrls: ['./generic-discover.page.scss'],
    standalone: true,
    imports: [
        IonContent,
        IonHeader,
        IonTitle,
        IonToolbar,
        IonButtons,
        IonButton,
        CommonModule,
        MediaListComponent
    ]
})
export class GenericDiscoverPage implements OnInit {
    title: string = 'Discover';
    items: any[] = [];
    type: 'movie' | 'tv' | 'person' = 'movie';
    categoryMethod: string = '';
    extraParams: any = null;
    currentPage: number = 1;
    isLoading: boolean = false;

    constructor(
        private route: ActivatedRoute,
        private tmdbService: TmdbSearchService,
        private location: Location
    ) { }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.title = params['title'] || 'Discover';
            this.type = params['type'] || 'movie';
            this.categoryMethod = params['method'];
            this.extraParams = params['extraParams'] ? JSON.parse(params['extraParams']) : null;
            this.items = [];
            this.currentPage = 1;
            this.loadData();
        });
    }

    loadData(event?: InfiniteScrollCustomEvent) {
        if (!this.categoryMethod) {
            console.error('No category method specified');
            event?.target.complete();
            return;
        }

        this.isLoading = true;
        let serviceCall: Observable<any>;

        if (this.categoryMethod === 'getDiscoverMovies') {
            const apiParams = { ...this.extraParams, page: this.currentPage };
            serviceCall = this.tmdbService.getDiscoverMovies(apiParams);
        } else {
            serviceCall = (this.tmdbService as any)[this.categoryMethod](this.currentPage);
        }

        if (serviceCall instanceof Observable) {
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
        }
    }

    goBack() {
        this.location.back();
    }
}