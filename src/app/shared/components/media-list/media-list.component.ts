import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { InfiniteScrollCustomEvent, IonContent, IonInfiniteScroll, IonInfiniteScrollContent } from "@ionic/angular/standalone";

@Component({
    selector: 'app-media-list',
    templateUrl: './media-list.component.html',
    styleUrls: ['./media-list.component.scss'],
    standalone: true,
    imports: [CommonModule, IonInfiniteScroll, IonInfiniteScrollContent, DatePipe]
})
export class MediaListComponent {
    @Input() items: any[] = [];
    @Input() type: 'movie' | 'tv' | 'person' = 'movie';
    @Input() isLoading: boolean = false;

    // Optional: Emit event for infinite scroll if parent handles loading
    @Output() loadMore = new EventEmitter<InfiniteScrollCustomEvent>();

    constructor(private router: Router) { }

    navigateToDetail(id: number) {
        this.router.navigate([`/${this.type}-detail`, id]);
    }

    onIonInfinite(ev: any) {
        this.loadMore.emit(ev as InfiniteScrollCustomEvent);
    }
}
