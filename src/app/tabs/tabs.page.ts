import { Component, EnvironmentInjector, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService } from 'src/services/storage.service';
import { Subscription } from 'rxjs';
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
  flame,
  filmSharp,
  tvSharp,
  hourglassSharp,
  mailSharp,
  mailOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [
    CommonModule,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonBadge
  ],
})
export class TabsPage implements OnInit, OnDestroy {
  public environmentInjector = inject(EnvironmentInjector);
  public inboxCount: number = 0;
  private storageSub?: Subscription;

  constructor(private storageService: StorageService) {
    addIcons({ filmSharp, tvSharp, flame, hourglassSharp, mailSharp, mailOutline });
  }

  async ngOnInit() {
    await this.updateInboxCount();
    this.storageSub = this.storageService.storageChanged$.subscribe(() => {
      this.updateInboxCount();
    });
  }

  ngOnDestroy() {
    if (this.storageSub) {
      this.storageSub.unsubscribe();
    }
  }

  private async updateInboxCount() {
    const inboxList = await this.storageService.getInbox();
    this.inboxCount = inboxList.length;
  }
}
