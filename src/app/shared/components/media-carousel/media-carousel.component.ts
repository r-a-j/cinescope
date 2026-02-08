import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from "@ionic/angular/standalone";

@Component({
    selector: 'app-media-carousel',
    templateUrl: './media-carousel.component.html',
    styleUrls: ['./media-carousel.component.scss'],
    standalone: true,
    imports: [CommonModule, IonButton]
})
export class MediaCarouselComponent {
    @Input() title: string = '';
    @Input() viewAllRoute: string = '';
    @Input() items: any[] = [];
    @Input() type: 'movie' | 'tv' = 'movie';

    constructor(private router: Router) { }

    navigateToDetail(id: number) {
        this.router.navigate([`/${this.type}-detail`, id]);
    }

    navigateToViewAll() {
        if (this.viewAllRoute) {
            this.router.navigate([this.viewAllRoute]);
        }
    }
}
