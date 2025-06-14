import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonLabel,
  IonChip,
  IonIcon,
  IonButtons,
  IonButton,
  NavController,
  ToastController,
  IonThumbnail,
  IonCol, 
  IonCard, 
  IonRow, 
  IonAccordionGroup, 
  IonAccordion, 
  IonItem 
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { TvDetailModel } from 'src/models/tv/tv-detail.model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { StorageService } from 'src/services/storage.service';
import { ContentModel } from 'src/models/content.model';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  bookmark,
  calendarOutline,
  star,
  timeOutline,
  close
} from 'ionicons/icons';

@Component({
  selector: 'app-tv-detail',
  templateUrl: './tv-detail.page.html',
  styleUrls: ['./tv-detail.page.scss'],
  standalone: true,
  imports: [
    IonItem,
    IonAccordion,
    IonAccordionGroup,
    IonRow,
    IonCard,
    IonCol,
    IonButton,
    IonButtons,
    IonIcon,
    IonChip,
    IonLabel,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonThumbnail
],
})
export class TvDetailPage implements OnInit {
  bookmarkIcon: string = 'assets/bookmark-empty.png';

  tvId: string | null = null;
  tvDetail: TvDetailModel | null = null;
  safeYoutubeUrl: SafeResourceUrl | null = null;
  isScrolled = false;

  isInWatchlist: boolean = false;
  isInWatched: boolean = false;
  bookmarkColor: 'danger' | 'success' | 'medium' = 'medium';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tmdbService: TmdbSearchService,
    private storageService: StorageService,
    private sanitizer: DomSanitizer,
    private toastController: ToastController,
    private navCtrl: NavController
  ) {
    addIcons({
      arrowBackOutline,
      bookmark,
      calendarOutline,
      timeOutline,
      star,
      close
    });
  }

  async ngOnInit() {
    this.tvId = this.route.snapshot.paramMap.get('id');
    if (!this.tvId) return;

    await this.loadTvDetail(+this.tvId);
    await this.refreshBookmarkState();
  }

  goBack(): void {
    this.navCtrl.back();
  }

  async loadTvDetail(id: number) {
    this.tmdbService.getTvDetail(id).subscribe({
      next: (data) => {
        
        this.tvDetail = data;
        console.log(this.tvDetail);
        // Prefer trailer video
        const trailer = data?.videos?.results?.find(
          (v) => v.type === 'Trailer' && v.site === 'YouTube'
        );
        const videoKey = trailer?.key || data?.videos?.results?.[0]?.key;

        if (videoKey) {
          this.safeYoutubeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoKey}`);
        }
      },
      error: (err) => {
        console.error('Failed to fetch tv detail', err);
      }
    });
  }

  onScroll(event: any) {
    const scrollTop = event.detail.scrollTop;
    this.isScrolled = scrollTop > 150;
  }

  async refreshBookmarkState() {
    if (!this.tvId) return;

    const id = +this.tvId!;
    const watchlist = await this.storageService.getWatchlist();
    const watched = await this.storageService.getWatched();

    this.isInWatchlist = !!watchlist.find(c => c.contentId === id && c.isTv);
    this.isInWatched = !!watched.find(c => c.contentId === id && c.isTv);

    if (this.isInWatched) {
      this.bookmarkIcon = 'assets/bookmark-watched.png';
    } else if (this.isInWatchlist) {
      this.bookmarkIcon = 'assets/bookmark-watchlist.png';
    } else {
      this.bookmarkIcon = 'assets/bookmark-empty.png';
    }
  }

  async toggleBookmarkState() {
    if (!this.tvDetail) return;

    const id = this.tvDetail.id!;

    if (this.isInWatched) {
      // Currently watched → remove it from watched
      await this.storageService.removeFromWatched(id, false, true);
      this.isInWatched = false;
      this.isInWatchlist = false;
    }
    else if (this.isInWatchlist) {
      // Currently in watchlist → move it to watched
      await this.storageService.moveFromWatchlistToWatched(id, false, true);
      this.isInWatched = true;
      this.isInWatchlist = false;
    }
    else {
      // Not in any list → add to watchlist
      const content: ContentModel = {
        contentId: id,
        isMovie: false,
        isTv: true,
        isWatched: false,
        isWatchlist: true
      };
      await this.storageService.addToWatchlist(content);
      this.isInWatchlist = true;
      this.isInWatched = false;
    }

    this.refreshBookmarkState(); // Refresh icon
    this.storageService.emitStorageChanged();
  }

  async toggleWatchlist() {
    if (!this.tvDetail) return;

    if (this.isInWatchlist) {
      await this.storageService.removeFromWatchlist(this.tvDetail.id!, false, true);
      this.showToast('Removed from Watchlist', 'danger');
    } else {
      const content: ContentModel = {
        contentId: this.tvDetail.id!,
        isMovie: false,
        isTv: true,
        isWatched: false,
        isWatchlist: true
      };

      // Check if the tv is already in the watchlist before adding it
      const watchlist = await this.storageService.getWatchlist();
      const isDuplicate = watchlist.some(c => c.contentId === content.contentId && c.isTv === content.isTv);

      if (!isDuplicate) {
        await this.storageService.addToWatchlist(content);
        this.showToast('Added to Watchlist', 'success');
      } else {
        this.showToast('TV already in Watchlist', 'danger');
      }
    }

    await this.refreshBookmarkState();
    this.storageService.emitStorageChanged();
  }

  async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });
    toast.present();
  }

  navigateToDetail(category: 'movie' | 'tv', id: number | string): void {
    this.router.navigate([`/${category}-detail`, id]);
  }
}
