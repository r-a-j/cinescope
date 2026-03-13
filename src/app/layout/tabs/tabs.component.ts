import { Component, EnvironmentInjector, inject } from '@angular/core';
import {
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    film,
    tv,
    flame,
    hourglass,
    mail
} from 'ionicons/icons';

@Component({
    selector: 'app-tabs',
    standalone: true,
    imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
    templateUrl: 'tabs.component.html',
    styleUrls: ['tabs.component.scss'],
})
export class TabsComponent {
    public environmentInjector = inject(EnvironmentInjector);

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