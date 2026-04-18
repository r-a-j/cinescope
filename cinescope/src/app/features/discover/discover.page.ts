import { Component, ChangeDetectionStrategy, signal, inject, OnInit, AfterViewInit } from '@angular/core';
import { IonContent, IonToolbar, IonSegment, IonSegmentButton, IonLabel, SegmentCustomEvent, IonSkeletonText } from '@ionic/angular/standalone';
import { DatePipe, SlicePipe } from '@angular/common';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { HeroBannerComponent } from '../../shared/components/hero-banner/hero-banner.component';
import { SwimlaneComponent } from '../../shared/components/swimlane/swimlane.component';
import { TrendingStore } from 'src/app/core/store/trending.store';
import { FeedService } from 'src/app/core/services/feed.service';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonImg, IonButton, IonIcon } from '@ionic/angular/standalone';

export type DiscoverSection = 'desi-hub' | 'bollywood' | 'trending' | 'top-rated' | 'actors' | 'news';

export interface DiscoverTab {
    value: DiscoverSection;
    label: string;
}

@Component({
    selector: 'app-discover',
    standalone: true,
    imports: [
        IonSkeletonText,
        IonLabel,
        IonSegmentButton,
        IonSegment,
        IonToolbar,
        IonContent,
        HeaderComponent,
        HeroBannerComponent,
        SwimlaneComponent,
        IonSkeletonText,
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardContent,
        IonImg,
        IonButton,
        IonIcon,
        DatePipe,
        SlicePipe
    ],
    providers: [TrendingStore],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './discover.page.html',
    styleUrls: ['./discover.page.scss'],
})
export class DiscoverPage implements OnInit, AfterViewInit {
    public store = inject(TrendingStore);
    public feedService = inject(FeedService);

    public activeSection = signal<DiscoverSection>('trending');

    public discoverTabs: DiscoverTab[] = [
        { value: 'desi-hub', label: 'DESI HUB' },
        { value: 'bollywood', label: 'BOLLYWOOD' },
        { value: 'top-rated', label: 'TOP RATED' },
        { value: 'trending', label: 'TRENDING' },
        { value: 'actors', label: 'ACTORS' },
        { value: 'news', label: 'NEWS' }
    ];

    ngOnInit(): void {
        this.store.loadTrendingData();
    }

    // NEW: Fire the centering logic right after the DOM initially paints
    ngAfterViewInit(): void {
        this.centerActiveTab(this.activeSection(), false); // instant centering
    }

    public onSectionChange(event: Event): void {
        const segmentEvent = event as SegmentCustomEvent;
        if (segmentEvent.detail.value) {
            const newSection = segmentEvent.detail.value as DiscoverSection;
            this.activeSection.set(newSection);

            // Fetch news dynamically when tapping the news tab
            if (newSection === 'news' && this.feedService.feedItems().length === 0) {
                this.feedService.refreshFeed();
            }

            // NEW: Recenter the scrollbar whenever the user taps a different tab
            this.centerActiveTab(newSection, true); // smooth centering
        }
    }

    // NEW: The core centering logic
    private centerActiveTab(section: DiscoverSection, isSmooth = true): void {
        // We use requestAnimationFrame to guarantee Angular has finished 
        // applying the 'active' classes before we calculate the scroll math
        requestAnimationFrame(() => {
            // Find the specific segment button in the DOM
            const button = document.querySelector(`ion-segment-button[value="${section}"]`);

            if (button) {
                // Command the browser engine to smoothly glide it to the center
                button.scrollIntoView({
                    behavior: isSmooth ? 'smooth' : 'auto', // 'auto' removes the snap animation on initial load
                    inline: 'center', // This is the magic property!
                    block: 'nearest'
                });
            }
        });
    }
}