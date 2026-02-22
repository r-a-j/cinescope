import { Component, OnInit, inject, NgZone, OnDestroy, ElementRef, ChangeDetectorRef } from '@angular/core';
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
    private cdr = inject(ChangeDetectorRef);

    constructor() { }

    ionViewDidEnter() {
        // 1. Force a refresh so gestures attach to the VISIBLE DOM
        this.loadTimeline();

        // 2. Subscribe only while the user is actually looking at this page
        if (!this.storageSub || this.storageSub.closed) {
            this.storageSub = this.storageService.storageChanged$.subscribe(() => {
                this.loadTimeline();
            });
        }
    }

    // Add this new lifecycle method
    ionViewDidLeave() {
        if (this.storageSub) {
            this.storageSub.unsubscribe();
        }
        this.destroyGestures();
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        if (this.storageSub) this.storageSub.unsubscribe();
        this.destroyGestures();
    }

    async loadTimeline() {
        const watchedItems = await this.storageService.getWatched();
        this.timelineNodes = this.timelineService.generateTimeline(watchedItems);
        this.cdr.detectChanges();
        this.initGestures();
    }

    destroyGestures() {
        this.gestures.forEach(g => g.destroy());
        this.gestures = [];
    }

    initGestures() {
        this.destroyGestures();

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
                    cardEl.style.transition = 'none';
                },
                onMove: (ev) => {
                    const opacity = Math.max(0, 1 - (Math.abs(ev.deltaX) / 120));
                    cardEl.style.transform = `translateX(${ev.deltaX}px) rotate(${ev.deltaX / 15}deg)`;
                    cardEl.style.opacity = opacity.toString();
                },
                onEnd: (ev) => {
                    if (bgContent) bgContent.style.overflowY = 'auto';

                    cardEl.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';

                    if (Math.abs(ev.deltaX) > 50 && node.items.length > 1) {
                        const moveOutWidth = document.body.clientWidth;
                        const direction = ev.deltaX > 0 ? 1 : -1;

                        cardEl.style.transform = `translateX(${direction * moveOutWidth}px) rotate(${direction * 30}deg)`;
                        cardEl.style.opacity = '0';

                        setTimeout(() => {
                            this.ngZone.run(() => {
                                cardEl.style.transition = 'none';
                                cardEl.style.transform = '';
                                cardEl.style.opacity = '';

                                const newItems = [...node.items];
                                const shifted = newItems.shift();
                                if (shifted) newItems.push(shifted);
                                node.items = newItems;

                                // 🚨 MAGIC BULLET: Force DOM to reflect the shifted array instantly
                                this.cdr.detectChanges();
                            });

                            // Reattach physics instantly
                            this.initGestures();
                            this.isDragging = false;
                        }, 400);
                    } else {
                        cardEl.style.transform = '';
                        cardEl.style.opacity = '';
                        setTimeout(() => this.isDragging = false, 50);
                    }
                }
            });
            gesture.enable(true);
            this.gestures.push(gesture);
        });
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
