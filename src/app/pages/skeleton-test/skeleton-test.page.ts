import { Component, OnInit, inject, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, GestureController, Gesture } from '@ionic/angular';
import { BottomSheetComponent } from 'src/app/shared/components/bottom-sheet/bottom-sheet.component';
import { TimelineService, TimelineNode, SingleNode, StackedNode } from 'src/services/timeline.service';
import { ContentModel } from 'src/models/content.model';

@Component({
    selector: 'app-skeleton-test',
    templateUrl: './skeleton-test.page.html',
    styleUrls: ['./skeleton-test.page.scss'],
    standalone: true,
    imports: [IonicModule, CommonModule, BottomSheetComponent]
})
export class SkeletonTestPage implements OnInit, AfterViewInit {
    private timelineService = inject(TimelineService);
    private gestureCtrl = inject(GestureController);
    private ngZone = inject(NgZone);
    public timelineNodes: TimelineNode[] = [];
    private gestures: Gesture[] = [];
    private isDragging = false;

    constructor() { }

    ngOnInit() {
        const mockData: ContentModel[] = [
            { contentId: 1, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Single Node Day', watchedAt: '2023-11-01T14:30:00Z' },
            { contentId: 2, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 1 - Item 1', watchedAt: '2023-11-05T10:00:00Z' },
            { contentId: 3, isMovie: false, isTv: true, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 1 - Item 2', watchedAt: '2023-11-05T18:00:00Z' },
            { contentId: 4, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Single Node Day 2', watchedAt: '2023-11-10T20:45:00Z' },
            { contentId: 5, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 2 - Item 1', watchedAt: '2023-11-15T09:15:00Z' },
            { contentId: 6, isMovie: false, isTv: true, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 2 - Item 2', watchedAt: '2023-11-15T21:00:00Z' },
            { contentId: 7, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 2 - Item 3', watchedAt: '2023-11-15T23:59:00Z' },
            { contentId: 8, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Single Node Day 3', watchedAt: '2023-12-01T08:00:00Z' },
            { contentId: 9, isMovie: false, isTv: true, isWatched: true, isWatchlist: false, title: 'Single Node Day 4', watchedAt: '2024-01-01T14:00:00Z' }
        ];

        this.timelineNodes = this.timelineService.generateTimeline(mockData);
    }

    ngAfterViewInit() {
        this.initGestures();
    }

    initGestures() {
        setTimeout(() => {
            this.gestures.forEach(g => g.destroy());
            this.gestures = [];

            const cards = document.querySelectorAll('.top-card');
            const bgContent = document.querySelector('.background-content') as HTMLElement;

            cards.forEach((cardEl: any) => {
                const nodeIndex = parseInt(cardEl.getAttribute('data-node-index'), 10);
                const node = this.timelineNodes[nodeIndex] as StackedNode;

                const gesture = this.gestureCtrl.create({
                    el: cardEl,
                    gestureName: 'swipe-card' + nodeIndex,
                    direction: 'x',
                    threshold: 5,
                    onStart: () => {
                        this.isDragging = true;
                        if (bgContent) bgContent.style.overflowY = 'hidden';
                        cardEl.style.transition = 'none'; // remove transition during drag
                    },
                    onMove: (ev) => {
                        cardEl.style.transform = `translateX(${ev.deltaX}px) rotate(${ev.deltaX / 15}deg)`;
                    },
                    onEnd: (ev) => {
                        if (bgContent) bgContent.style.overflowY = 'auto';
                        cardEl.style.transition = 'transform 0.3s ease';

                        // Swipe away threshold
                        if (Math.abs(ev.deltaX) > 50) {
                            const moveOutWidth = document.body.clientWidth;
                            const direction = ev.deltaX > 0 ? 1 : -1;
                            cardEl.style.transform = `translateX(${direction * moveOutWidth}px) rotate(${direction * 30}deg)`;

                            setTimeout(() => {
                                // WAKE UP ANGULAR: Force it to see the array change!
                                this.ngZone.run(() => {
                                    // Instantly clear the swiped card's styles so it can go to the back of the deck
                                    cardEl.style.transition = 'none';
                                    cardEl.style.transform = '';

                                    // Cycle the data
                                    const newItems = [...node.items];
                                    const shifted = newItems.shift();
                                    if (shifted) newItems.push(shifted);
                                    node.items = newItems;
                                });

                                // Give the DOM 50ms to render the new card layout, then re-attach the swipe listeners
                                setTimeout(() => {
                                    this.initGestures();
                                    setTimeout(() => this.isDragging = false, 50); // Unlock click
                                }, 50);

                            }, 300);
                        } else {
                            // Snap back to center
                            cardEl.style.transform = '';
                            setTimeout(() => this.isDragging = false, 50);
                        }
                    }
                });
                gesture.enable(true);
                this.gestures.push(gesture);
            });
        }, 100); // Slight delay ensures Angular ngFor has rendered DOM
    }

    onCardClick(item: ContentModel) {
        if (this.isDragging) return;
        console.log('Navigate to details for:', item.title);
    }

    // Helpers to cast node for the template without using $any
    asSingle(node: TimelineNode): SingleNode {
        return node as SingleNode;
    }

    asStacked(node: TimelineNode): StackedNode {
        return node as StackedNode;
    }

    trackById(index: number, item: ContentModel) {
        return item.contentId;
    }
}
