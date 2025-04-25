import { Component } from '@angular/core';
import { IonContent, IonToolbar, IonSegmentButton, IonLabel, IonSegment } from '@ionic/angular/standalone';
import { HeaderComponent } from '../header/header.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiscoverBollywoodComponent } from '../discover-bollywood/discover-bollywood.component';
import { DiscoverTopRatedComponent } from '../discover-top-rated/discover-top-rated.component';
import { DiscoverTrendingComponent } from '../discover-trending/discover-trending.component';
import { DiscoverActorsComponent } from '../discover-actors/discover-actors.component';

interface MediaItem {
  id: number;
  title: string;
  rating?: number;
  year?: number;
  poster_path?: string;
}

@Component({
  selector: 'app-discover',
  templateUrl: 'discover.page.html',
  styleUrls: ['discover.page.scss'],
  imports: [
    IonLabel, 
    IonSegment, 
    IonSegmentButton, 
    IonToolbar,
    CommonModule,
    FormsModule,
    IonContent,
    HeaderComponent,
    DiscoverBollywoodComponent,
    DiscoverTopRatedComponent,
    DiscoverTrendingComponent,
    DiscoverActorsComponent],
})
export class DiscoverPage {
  segmentValue: string = 'bollywood';
  scrollTop: number = 0;

  constructor() { }

  segmentChanged(event: any): void {
    this.segmentValue = event.detail.value;
  }
}
