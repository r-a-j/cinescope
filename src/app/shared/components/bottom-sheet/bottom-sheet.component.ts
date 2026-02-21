import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, GestureController, GestureDetail } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { sparkles, star } from 'ionicons/icons';

@Component({
    selector: 'app-bottom-sheet',
    templateUrl: './bottom-sheet.component.html',
    styleUrls: ['./bottom-sheet.component.scss'],
    standalone: true,
    imports: [CommonModule, IonicModule]
})
export class BottomSheetComponent implements AfterViewInit {
    @ViewChild('sheet', { read: ElementRef }) sheet!: ElementRef;
    @ViewChild('contentEl', { read: ElementRef }) contentEl!: ElementRef;

    public isExpanded: boolean = false;
    public items = Array.from({ length: 100 }, (_, i) => i + 1);

    private startY: number = 0;

    private snapPoints: { expanded: number; anchored: number; peeking: number } = {
        expanded: 0,
        anchored: 0,
        peeking: 0
    };

    private currentY: number = 0;
    private safeAreaTop = 0;
    private safeAreaBottom = 0;

    constructor(private gestureCtrl: GestureController, private renderer: Renderer2) {
        addIcons({ sparkles });
    }

    ngAfterViewInit() {
        this.calculateSnapPoints();

        // Initialize at anchored
        this.currentY = this.snapPoints.anchored;
        this.isExpanded = false;
        this.renderer.removeClass(this.contentEl.nativeElement, 'scrollable');
        this.updateTransform(this.currentY);

        const gesture = this.gestureCtrl.create({
            el: this.sheet.nativeElement,
            gestureName: 'bottom-sheet-swipe',
            direction: 'y',
            threshold: 5,
            capture: true,
            canStart: (ev) => this.canStart(ev),
            onStart: () => this.onStart(),
            onMove: (ev) => this.onMove(ev),
            onEnd: (ev) => this.onEnd(ev)
        });

        gesture.enable(true);

        // Re-calculate on resize
        window.addEventListener('resize', () => {
            this.calculateSnapPoints();
            // Ideally re-snap to nearest point here
        });
    }

    private calculateSnapPoints() {
        // Attempt to get safe area insets if possible, otherwise rely on CSS/Capacitor calls in a real app.
        // For this skeleton, we'll estimate or use standard CSS env vars via computed style if needed, 
        // but simpler to use window height percentages.

        const height = window.innerHeight;

        // We can try to read env vars from a dummy element or just assume standard values for now if precise pixel reading isn't easy in pure JS without a plugin.
        // However, the prompt asked to use CSS env vars for calculations. 
        // Since we are in JS, we can't directly use env() in math. 
        // We will assume 0 for now or try to measure a fixed element.
        // A robust way: create a div with height: env(safe-area-inset-top), read it, then remove it.

        this.safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ion-safe-area-top')) || 0;
        this.safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ion-safe-area-bottom')) || 0;

        // Expanded: 5vh from top (plus safe area)
        // Actually, "TranslateY pushes DOWN".
        // Top of screen is 0.
        // Sheet height is 95vh.
        // To be expanded (95% visible), we want the TOP of the sheet to be at:
        // 5vh + safeAreaTop.
        this.snapPoints.expanded = (height * 0.05) + this.safeAreaTop;

        // Anchored: 50% visible. Top of sheet at 50vh.
        this.snapPoints.anchored = height * 0.5;

        // Peeking: 10% visible from bottom. 
        // This means top is at 90% of screen height.
        this.snapPoints.peeking = (height * 0.9) - this.safeAreaBottom;

        console.log('SnapPoints calculated:', this.snapPoints);
    }

    private canStart(ev: GestureDetail): boolean {
        const target = ev.event.target as HTMLElement;
        const isDragHandleArea = target.closest('.drag-handle-area');

        // Rule 1: Always intercept if dragging handle area
        if (isDragHandleArea) {
            return true;
        }

        // Rule 2: If not expanded (Peeking or Anchored), we ALWAYS lock scroll and drag the sheet
        if (!this.isExpanded) {
            return true;
        }

        // Rule 3 & 4 (The Handoff Edge Case):
        // Crucial Edge Case for canStart: When the sheet is in the Expanded state and the user's scrollTop is 0,
        // if they swipe DOWN (which corresponds to ev.deltaY > 0), the GestureController MUST return true in canStart
        // to hijack the touch and pull the sheet down. However, if they swipe UP (ev.deltaY < 0), canStart MUST
        // return false so the native browser scrolling can take over and scroll the list down. Use a @ViewChild to
        // reference the .sheet-content element to accurately read its scrollTop property inside the gesture's canStart method.
        if (this.isExpanded && this.contentEl) {
            const scrollTop = this.contentEl.nativeElement.scrollTop;
            if (scrollTop === 0 && ev.deltaY > 0) {
                return true; // Hijack touch, pull sheet down
            }
        }

        // Return false so native browser scrolling can take over
        return false;
    }

    private onStart() {
        this.startY = this.currentY;
        this.renderer.setStyle(this.sheet.nativeElement, 'transition', 'none');
    }

    private onMove(ev: GestureDetail) {
        const newY = this.startY + ev.deltaY;

        // Rubber banding or clamping?
        // Let's clamp for now to avoid dragging off screen completely
        // if (newY < this.snapPoints.expanded - 20) return; // limit upward

        this.updateTransform(newY);
    }

    private onEnd(ev: GestureDetail) {
        // 5. Re-enable the smooth transition for the snap
        this.renderer.setStyle(this.sheet.nativeElement, 'transition', 'transform 0.3s cubic-bezier(0.2, 0.0, 0, 1)');

        const velocity = ev.velocityY;
        const finalY = this.startY + ev.deltaY; // Where we let go
        let targetY = this.snapPoints.peeking;

        // 6. Velocity Logic (The "Flick")
        // If flicking UP quickly (negative velocity)
        if (velocity < -0.5) {
            // REQUIREMENT: If starting from Peeking and flicking hard, SKIP to Expanded
            if (this.startY > this.snapPoints.anchored) {
                targetY = this.snapPoints.expanded; // Skip middle!
            } else {
                targetY = this.snapPoints.expanded;
            }
        }
        // If flicking DOWN quickly
        else if (velocity > 0.5) {
            targetY = this.snapPoints.peeking;
        }
        // Low Velocity (Drag and Drop): Find nearest snap point
        else {
            const distExpanded = Math.abs(finalY - this.snapPoints.expanded);
            const distAnchored = Math.abs(finalY - this.snapPoints.anchored);
            const distPeeking = Math.abs(finalY - this.snapPoints.peeking);

            const min = Math.min(distExpanded, distAnchored, distPeeking);

            if (min === distExpanded) targetY = this.snapPoints.expanded;
            else if (min === distAnchored) targetY = this.snapPoints.anchored;
            else targetY = this.snapPoints.peeking;
        }

        this.currentY = targetY;
        this.isExpanded = (this.currentY === this.snapPoints.expanded);
        if (this.isExpanded) {
            this.renderer.addClass(this.contentEl.nativeElement, 'scrollable');
        } else {
            this.renderer.removeClass(this.contentEl.nativeElement, 'scrollable');
        }
        this.updateTransform(this.currentY);
    }

    private updateTransform(y: number) {
        this.renderer.setStyle(this.sheet.nativeElement, 'transform', `translateY(${y}px)`);
    }
}
