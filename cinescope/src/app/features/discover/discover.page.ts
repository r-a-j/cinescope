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
    IonButton,
    IonIcon,
    IonRefresher,
    IonRefresherContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refreshOutline, swapVerticalOutline, openOutline } from 'ionicons/icons';
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
        IonIcon,
        IonRefresher,
        IonRefresherContent,
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
        { value: 'trending', label: 'TRENDING' },
        { value: 'desi-hub', label: 'DESI HUB' },
        { value: 'bollywood', label: 'BOLLYWOOD' },
        { value: 'top-rated', label: 'TOP RATED' },
        { value: 'actors', label: 'ACTORS' },
        { value: 'news', label: 'NEWS' }
    ];

    // Default to 'trending'
    public activeSection = signal<string>('trending');

    constructor() {
        addIcons({ refreshOutline, swapVerticalOutline, openOutline });
    }

    ngOnInit(): void {
        this.store.loadTrendingData();
    }

    public async onPullRefresh(event: CustomEvent): Promise<void> {
        const section = this.activeSection();
        if (section === 'trending') {
            await this.store.loadTrendingData(true);
        } else if (section === 'desi-hub') {
            await this.store.loadDesiHubData(true);
        } else if (section === 'bollywood') {
            await this.store.loadBollywoodData(true);
        } else if (section === 'top-rated') {
            await this.store.loadTopRatedData(true);
        } else if (section === 'actors') {
            await this.store.loadActorsData(true);
        } else if (section === 'news') {
            await this.feedService.refreshFeed();
        }
        const target = event.target as HTMLIonRefresherElement | null;
        if (target) {
            await target.complete();
        }
    }

    public setNewsSource(source: string): void {
        this.feedService.activeFilter.set(source);
    }

    public toggleNewsSort(): void {
        const next = this.feedService.sortDirection() === 'newest' ? 'oldest' : 'newest';
        this.feedService.sortDirection.set(next);
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