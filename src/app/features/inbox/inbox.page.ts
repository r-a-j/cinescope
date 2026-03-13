import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { HeaderComponent } from 'src/app/shared/components/header/header.component';

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [IonContent, HeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header></app-header>
    
    <ion-content color="background">
      <h1 style="color: white; text-align: center; margin-top: 50px;">INBOX TAB</h1>
    </ion-content>
  `,
})
export class InboxPage { }
