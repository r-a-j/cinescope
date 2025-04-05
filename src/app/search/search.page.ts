import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonToolbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSearchbar,
  IonHeader,
  IonButtons,
  IonButton,
  IonIcon, IonTitle } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline, clipboardOutline } from 'ionicons/icons';
import { Clipboard } from '@capacitor/clipboard';
import { Dialog } from '@capacitor/dialog';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [IonTitle, 
    IonIcon,
    IonButton,
    IonButtons,
    IonHeader,
    IonSearchbar,
    IonLabel,
    IonSegmentButton,
    IonSegment,
    IonContent,
    IonToolbar,
    CommonModule,
    FormsModule
  ],
})
export class SearchPage implements OnInit, AfterViewInit {

  @ViewChild(IonSearchbar, { static: false }) searchBar!: IonSearchbar;

  // Segment model
  segmentValue: string = 'movies';

  // Two-way bind for the search text
  searchQuery: string = '';

  constructor(private router: Router) {
    addIcons({arrowBackOutline,clipboardOutline});
  }

  ngOnInit() {
    // ...
  }

  async pasteFromClipboard(): Promise<void> {
    const { value } = await Clipboard.read();
    if (value) {
      this.searchQuery = value;
    } else {
      await Dialog.alert({
        title: 'Clipboard Empty',
        message: 'There is no text to paste from clipboard.'
      });
    }
  }

  // After the view has initialized, we can safely access the IonSearchbar
  async ngAfterViewInit(): Promise<void> {
    // Delay to ensure view is ready before accessing searchBar
    setTimeout(async () => {
      try {
        // Focus the searchbar
        await this.searchBar.setFocus();

        // // Check clipboard
        // const { value } = await Clipboard.read();

        // if (value?.trim()) {
        //   const { value: userConfirmed } = await Dialog.confirm({
        //     title: 'Paste from Clipboard?',
        //     message: `We found "${value}" on your clipboard. Paste it here?`
        //   });

        //   if (userConfirmed) {
        //     this.searchQuery = value;
        //   }
        // }
      } catch (err) {
        console.error('Clipboard read or focus error:', err);
      }
    }, 300);
  }

  goHome(): void {
    this.router.navigate(['/tabs']);
  }

  segmentChanged(event: any) {
    this.segmentValue = event.detail.value;
  }
}
