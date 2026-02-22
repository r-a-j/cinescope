import { Component, OnInit, inject, NgZone, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, GestureController, Gesture } from '@ionic/angular';
import { BottomSheetComponent } from 'src/app/shared/components/bottom-sheet/bottom-sheet.component';
import { TimelineService, TimelineNode, SingleNode, StackedNode } from 'src/services/timeline.service';
import { ContentModel } from 'src/models/content.model';
import { StorageService } from 'src/services/storage.service';
import { HeaderComponent } from 'src/app/header/header.component';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
    selector: 'app-skeleton-test',
    templateUrl: './skeleton-test.page.html',
    styleUrls: ['./skeleton-test.page.scss'],
    standalone: true,
    imports: [IonicModule, CommonModule, BottomSheetComponent, HeaderComponent]
})
export class SkeletonTestPage implements OnInit, OnDestroy {
    private timelineService = inject(TimelineService);
    private gestureCtrl = inject(GestureController);
    private ngZone = inject(NgZone);
    private storageService = inject(StorageService);
    public timelineNodes: TimelineNode[] = [];
    private gestures: Gesture[] = [];
    private isDragging = false;
    private storageSub!: Subscription;
    private router = inject(Router);
    private el = inject(ElementRef);

    constructor() { }

    ionViewDidEnter() {
        this.initGestures();
    }

    ngOnInit() {
        this.loadTimeline();

        this.storageSub = this.storageService.storageChanged$.subscribe(() => {
            this.loadTimeline();
        });
    }

    ngOnDestroy() {
        if (this.storageSub) {
            this.storageSub.unsubscribe();
        }
        this.gestures.forEach(g => g.destroy());
    }

    async loadTimeline() {
        const watchedItems = await this.storageService.getWatched();
        this.timelineNodes = this.timelineService.generateTimeline(watchedItems);

        setTimeout(() => {
            this.initGestures();
        }, 100);
    }

    initGestures() {
        setTimeout(() => {
            this.gestures.forEach(g => g.destroy());
            this.gestures = [];

            const cards = this.el.nativeElement.querySelectorAll('.top-card');
            const bgContent = this.el.nativeElement.querySelector('.background-content') as HTMLElement;

            cards.forEach((cardEl: any) => {
                const nodeIndex = parseInt(cardEl.getAttribute('data-node-index'), 10);
                const node = this.timelineNodes[nodeIndex] as StackedNode;

                const gesture = this.gestureCtrl.create({
                    el: cardEl,
                    gestureName: 'swipe-card-' + nodeIndex,
                    direction: 'x',
                    threshold: 5,
                    onStart: () => {
                        this.isDragging = true;
                        if (bgContent) bgContent.style.overflowY = 'hidden';
                        cardEl.style.transition = 'none'; // remove transition during drag
                    },
                    onMove: (ev) => {
                        // 1. DYNAMIC FADE: Card fades out as it reaches ~120px away from origin
                        const opacity = Math.max(0, 1 - (Math.abs(ev.deltaX) / 120));

                        cardEl.style.transform = `translateX(${ev.deltaX}px) rotate(${ev.deltaX / 15}deg)`;
                        cardEl.style.opacity = opacity.toString(); // Apply real-time fade
                    },
                    onEnd: (ev) => {
                        if (bgContent) bgContent.style.overflowY = 'auto';

                        // 2. PREMIUM SNAP TRANSITION: Animate both transform AND opacity back
                        cardEl.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';

                        // 3. THE LOCK: Only swipe away IF moved > 50px AND there are multiple items!
                        if (Math.abs(ev.deltaX) > 50 && node.items.length > 1) {
                            const moveOutWidth = document.body.clientWidth;
                            const direction = ev.deltaX > 0 ? 1 : -1;

                            cardEl.style.transform = `translateX(${direction * moveOutWidth}px) rotate(${direction * 30}deg)`;
                            cardEl.style.opacity = '0'; // Ensure it fully fades out

                            setTimeout(() => {
                                // WAKE UP ANGULAR: Force it to see the array change!
                                this.ngZone.run(() => {
                                    // Instantly clear the swiped card's styles so it can go to the back of the deck
                                    cardEl.style.transition = 'none';
                                    cardEl.style.transform = '';
                                    cardEl.style.opacity = ''; // Reset opacity so SCSS takes over

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

                            }, 400);
                        } else {
                            // Snap back to center (Didn't swipe far enough, OR it's a single locked card)
                            cardEl.style.transform = '';
                            cardEl.style.opacity = ''; // Restores 100% opacity smoothly
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
        // Prevents a click from registering if the user was just swiping/dragging the card
        if (this.isDragging) return;

        // Route dynamically based on the content type
        if (item.isMovie) {
            this.router.navigate(['/movie-detail', item.contentId]);
        } else if (item.isTv) {
            this.router.navigate(['/tv-detail', item.contentId]);
        }
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
