import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    IonContent,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonButtons,
    IonToolbar,
    IonHeader,
    IonBackButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    settingsOutline,
    shieldCheckmarkOutline,
    colorPaletteOutline,
    notificationsOutline,
    cloudUploadOutline,
    trashOutline,
    informationCircleOutline,
    chevronForwardOutline
} from 'ionicons/icons';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [
        CommonModule,
        IonContent,
        IonIcon,
        IonList,
        IonItem,
        IonLabel,
        IonButtons,
        IonToolbar,
        IonHeader,
        IonBackButton
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
    constructor() {
        addIcons({
            settingsOutline,
            shieldCheckmarkOutline,
            colorPaletteOutline,
            notificationsOutline,
            cloudUploadOutline,
            trashOutline,
            informationCircleOutline,
            chevronForwardOutline
        });
    }
}