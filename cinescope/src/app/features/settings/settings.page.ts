import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
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
    IonBackButton,
    IonSelect,
    IonSelectOption
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
    chevronForwardOutline,
    moonOutline,
    sunnyOutline,
    contrastOutline
} from 'ionicons/icons';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';

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
        IonBackButton,
        IonSelect,
        IonSelectOption
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
    public themeService = inject(ThemeService);

    constructor() {
        addIcons({
            settingsOutline,
            shieldCheckmarkOutline,
            colorPaletteOutline,
            notificationsOutline,
            cloudUploadOutline,
            trashOutline,
            informationCircleOutline,
            chevronForwardOutline,
            moonOutline,
            sunnyOutline,
            contrastOutline
        });
    }

    public onThemeChange(event: any) {
        this.themeService.setTheme(event.detail.value as ThemeMode);
    }
}