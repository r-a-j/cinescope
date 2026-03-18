import {
    Component,
    ChangeDetectionStrategy,
    input,
    CUSTOM_ELEMENTS_SCHEMA,
    ElementRef,
    viewChild,
    effect,
    afterNextRender,
    Injector, // NEW: Import Injector
    inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeComponent } from '../badge/badge.component';

// 1. Strict Modular Imports (Prevents bundle bloat and fixes the compiler error)
import Swiper from 'swiper';
import { Autoplay, EffectFade } from 'swiper/modules';
import { register } from 'swiper/element/bundle';

import { HeroBannerItem } from '../../models/hero-banner-item.interface';

@Component({
    selector: 'app-hero-banner',
    standalone: true,
    imports: [CommonModule, BadgeComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './hero-banner.component.html',
    styleUrls: ['./hero-banner.component.scss']
})
export class HeroBannerComponent {
    public trendingItems = input.required<HeroBannerItem[]>();
    private injector = inject(Injector);

    // We drop 'required' here just in case the DOM is still evaluating
    private swiperEl = viewChild<ElementRef>('swiper');

    constructor() {
        register();
        Swiper.use([Autoplay, EffectFade]);

        effect(() => {
            const items = this.trendingItems();

            if (items.length > 0) {
                // NEW: Pass the injector in the options object so Angular doesn't lose context
                afterNextRender(() => {
                    const swiperNode = this.swiperEl()?.nativeElement;
                    if (swiperNode && !swiperNode.swiper) {
                        swiperNode.initialize();
                    }
                }, { injector: this.injector });
            }
        });
    }
}