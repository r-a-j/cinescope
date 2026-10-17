import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    IonContent,
    IonToolbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSkeletonText,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton
} from '@ionic/angular/standalone';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { HeroBannerComponent } from 'src/app/shared/components/hero-banner/hero-banner.component';
import { SwimlaneComponent } from 'src/app/shared/components/swimlane/swimlane.component';
import { TrendingStore } from '../../core/store/trending.store';
import { FeedService } from '../../core/services/feed.service';

@Component({
    selector: 'app-discover',
    standalone: true,
    imports: [
        CommonModule,
        IonContent,
        IonToolbar,
        IonSegment,
        IonSegmentButton,
        IonLabel,
        IonSkeletonText,
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardContent,
        IonButton,
        HeaderComponent,
        HeroBannerComponent,
        SwimlaneComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './discover.page.html',
    styleUrls: ['./discover.page.scss'],
})
export class DiscoverPage implements OnInit {
    public store = inject(TrendingStore);
    public feedService = inject(FeedService);

    public discoverTabs = [
        { value: 'desi-hub', label: 'DESI HUB' },
        { value: 'bollywood', label: 'BOLLYWOOD' },
        { value: 'top-rated', label: 'TOP RATED' },
        { value: 'trending', label: 'TRENDING' },
        { value: 'actors', label: 'ACTORS' },
        { value: 'news', label: 'NEWS' }
    ];

    // Default to 'trending'
    public activeSection = signal<string>('trending');

    ngOnInit(): void {
        this.store.loadTrendingData();
    }

    public onSectionChange(event: Event): void {
        const customEvent = event as CustomEvent;
        const newSection = customEvent.detail.value;

        if (newSection) {
            this.activeSection.set(newSection);

            if (newSection === 'desi-hub') {
                this.store.loadDesiHubData();
            } else if (newSection === 'bollywood') {
                this.store.loadBollywoodData();
            } else if (newSection === 'top-rated') {
                this.store.loadTopRatedData();
            } else if (newSection === 'actors') {
                this.store.loadActorsData();
            } else if (newSection === 'news' && this.feedService.feedItems().length === 0) {
                this.feedService.refreshFeed();
            }

            // Smoothly auto-center the clicked button
            const segmentEl = customEvent.target as HTMLElement;
            const activeBtn = segmentEl.querySelector(`ion-segment-button[value="${newSection}"]`);

            if (activeBtn) {
                activeBtn.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }
}