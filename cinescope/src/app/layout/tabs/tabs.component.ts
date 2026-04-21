import { Component, EnvironmentInjector, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    flash, flashOutline,
    sparkles, sparklesOutline,
    grid, gridOutline,
    people, peopleOutline,
    person, personOutline
} from 'ionicons/icons';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-tabs',
    standalone: true,
    imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
    templateUrl: 'tabs.component.html',
    styleUrls: ['tabs.component.scss'],
})
export class TabsComponent {
    public environmentInjector = inject(EnvironmentInjector);
    private router = inject(Router);
    
    public activeTab = signal<string>('pulse');

    constructor() {
        // Handle initial load
        const currentUrl = this.router.url;
        this.updateActiveTab(currentUrl);

        // Track the active tab for elegant state changes
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            takeUntilDestroyed() // Proper cleanup
        ).subscribe((event: any) => {
            this.updateActiveTab(event.urlAfterRedirects || event.url);
        });

        addIcons({
            flash, flashOutline,
            sparkles, sparklesOutline,
            grid, gridOutline,
            people, peopleOutline,
            person, personOutline
        });
    }

    private updateActiveTab(url: string): void {
        const segments = url.split('/').filter(s => !!s);
        const tab = segments.pop() || 'pulse';
        
        const colors: { [key: string]: string } = {
            'pulse': '#f85149',
            'oracle': '#79c0ff',
            'vault': '#2ee7b6',
            'social': '#d2a8ff',
            'identity': '#f0883e'
        };

        if (colors[tab]) {
            this.activeTab.set(tab);
            // SET GLOBAL THEME COLOR
            document.documentElement.style.setProperty('--active-tab-color', colors[tab]);
            document.documentElement.style.setProperty('--active-tab-glow', `${colors[tab]}40`); // 25% opacity
        }
    }
}