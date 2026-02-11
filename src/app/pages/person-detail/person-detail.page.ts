import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonChip,
  IonIcon,
  IonLabel,
  IonModal,
  IonButton
} from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { PersonDetailModel } from 'src/models/person-detail.model';
import { PersonCreditsModel } from 'src/models/person-credits.model';
import { MediaCarouselComponent } from 'src/app/shared/components/media-carousel/media-carousel.component';
import { Browser } from '@capacitor/browser';
import { addIcons } from 'ionicons';
import { calendarOutline, locationOutline, personOutline, logoInstagram, logoTwitter, logoFacebook, globeOutline, logoTiktok, logoYoutube, closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-person-detail',
  templateUrl: './person-detail.page.html',
  styleUrls: ['./person-detail.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonText,
    IonChip,
    IonIcon,
    IonLabel,
    IonModal,
    IonButton,
    CommonModule,
    FormsModule,
    MediaCarouselComponent
  ]
})
export class PersonDetailPage implements OnInit {
  person: PersonDetailModel | null = null;
  credits: PersonCreditsModel | null = null;
  knownFor: any[] = [];
  isLoading = true;
  error = false;

  // Image Viewer
  isImageModalOpen = false;
  selectedImage: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private tmdbService: TmdbSearchService
  ) {
    addIcons({ calendarOutline, locationOutline, personOutline, logoInstagram, logoTwitter, logoFacebook, globeOutline, logoTiktok, logoYoutube, closeOutline });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPersonData(+id);
    } else {
      this.error = true;
      this.isLoading = false;
    }
  }

  loadPersonData(id: number) {
    this.isLoading = true;
    this.error = false;

    this.tmdbService.getPersonDetail(id).subscribe({
      next: (data: any) => { // Using any cast to access combined properties easily without strict model extension for now if needed, or cast to updated model
        this.person = data;

        // Process credits from append_to_response
        if (data.combined_credits) {
          const cast = data.combined_credits.cast || [];
          this.knownFor = cast
            .sort((a: any, b: any) => b.popularity - a.popularity)
            .slice(0, 15);
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading person details', err);
        this.error = true;
        this.isLoading = false;
      }
    });
  }

  async openExternal(url: string) {
    await Browser.open({ url: url });
  }

  openImage(path: string) {
    this.selectedImage = 'https://image.tmdb.org/t/p/original' + path;
    this.isImageModalOpen = true;
  }

  closeImage() {
    this.isImageModalOpen = false;
    this.selectedImage = null;
  }

  /* loadCredits removed as it is now part of detail call */

  getGender(genderId: number): string {
    switch (genderId) {
      case 1: return 'Female';
      case 2: return 'Male';
      case 3: return 'Non-binary';
      default: return 'Not specified';
    }
  }
}
