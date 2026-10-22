import { Component, EnvironmentInjector, inject } from '@angular/core';
import {
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    film,
    tv,
    flame,
    hourglass,
    mail
} from 'ionicons/icons';
import { StorageService } from '../../core/services/storage.service';

@Component({
    selector: 'app-tabs',
    standalone: true,
    imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
    templateUrl: 'tabs.component.html',
    styleUrls: ['tabs.component.scss'],
})
export class TabsComponent {
    public environmentInjector = inject(EnvironmentInjector);
    public storage = inject(StorageService);

    constructor() {
        addIcons({
            film,
            tv,
            flame,
            hourglass,
            mail
        });
    }
}