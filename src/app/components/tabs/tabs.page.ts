import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { MovieSearchModalComponent } from '../movie-search-modal/movie-search-modal.component';
import { MovieDetails } from 'src/app/models/movie-details.model';
import { MovieService } from 'src/app/services/movie.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit {
  activeTab: string = 'tab1';
  watchlist: MovieDetails[] = [];

  constructor(
    private router: Router,
    private modalController: ModalController,
    private movieService: MovieService,
  ) { }

  async ngOnInit() {
    await this.loadWatchlist();
  }

  async loadWatchlist() {
    this.watchlist = await this.movieService.getWatchlist();
  }

  async openSearchModal() {
    const modal = await this.modalController.create({
      component: MovieSearchModalComponent,
      componentProps: { watchlist: this.watchlist }
    });
    return await modal.present();
  }

  openSettings() {
    this.router.navigate(['/tabs/settings']);
  }

  onTabChange(event: any) {
    this.activeTab = event.tab;
  }

}
