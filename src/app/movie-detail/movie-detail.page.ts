import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonIcon, IonButton, IonChip, IonHeader, IonToolbar, IonBackButton, IonButtons, IonTitle,
  NavController
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { bookmark, star, calendarOutline, timeOutline, close, arrowBackOutline } from 'ionicons/icons';
import { TmdbSearchService } from 'src/services/tmdb-search.service';
import { MovieDetailModel } from 'src/models/movie/movie-detail.model';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NumberSuffixPipe } from "../../pipes/number-suffix.pipe";
import { StorageService } from 'src/services/storage.service';
import { ContentModel } from 'src/models/content.model';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-movie-detail',
  templateUrl: './movie-detail.page.html',
  styleUrls: ['./movie-detail.page.scss'],
  standalone: true,
  imports: [IonTitle, IonButtons, IonBackButton, IonToolbar, IonHeader,
    IonChip,
    IonButton,
    IonIcon,
    IonContent,
    CommonModule,
    FormsModule, NumberSuffixPipe],
})
export class MovieDetailPage implements OnInit {
  movieId: string | null = null;
  movieDetail: MovieDetailModel | null = null;
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
    addIcons({arrowBackOutline,bookmark,calendarOutline,timeOutline,star,close});
  }

  async ngOnInit() {
    this.movieId = this.route.snapshot.paramMap.get('id');
    if (!this.movieId) return;

    await this.loadMovieDetail(+this.movieId);
    await this.refreshBookmarkState();
  }

  goHome(): void {
    this.router.navigate(['tabs/movie']);
  }

  async loadMovieDetail(id: number) {
    this.tmdbService.getMovieDetail(id).subscribe({
      next: (data) => {
        this.movieDetail = data;

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
        console.error('Failed to fetch movie detail', err);
      }
    });
  }

  onScroll(event: any) {
    const scrollTop = event.detail.scrollTop;
    this.isScrolled = scrollTop > 150;
  }

  async refreshBookmarkState() {
    if (!this.movieId) return;

    const id = +this.movieId!;
    const watchlist = await this.storageService.getWatchlist();
    const watched = await this.storageService.getWatched();

    this.isInWatchlist = !!watchlist.find(c => c.contentId === +id && c.isMovie);
    this.isInWatched = !!watched.find(c => c.contentId === +id && c.isMovie);

    if (this.isInWatched) {
      this.bookmarkColor = 'success'; // Green
    } else if (this.isInWatchlist) {
      this.bookmarkColor = 'danger'; // Red
    } else {
      this.bookmarkColor = 'medium'; // Light red (default)
    }
  }

  async toggleWatchlist() {
    if (!this.movieDetail) return;

    if (this.isInWatchlist) {
      await this.storageService.removeFromWatchlist(this.movieDetail.id!, true, false);
      this.showToast('Removed from Watchlist', 'danger');
    } else {
      const content: ContentModel = {
        contentId: this.movieDetail.id!,
        isMovie: true,
        isTv: false,
        isWatched: false,
        isWatchlist: true
      };

      // Check if the movie is already in the watchlist before adding it
      const watchlist = await this.storageService.getWatchlist();
      const isDuplicate = watchlist.some(c => c.contentId === content.contentId && c.isMovie === content.isMovie);

      if (!isDuplicate) {
        await this.storageService.addToWatchlist(content);
        this.showToast('Added to Watchlist', 'success');
      } else {
        this.showToast('Movie already in Watchlist', 'danger');
      }
    }

    await this.refreshBookmarkState();
    this.storageService.emitStorageChanged(); // Emit change!
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
}