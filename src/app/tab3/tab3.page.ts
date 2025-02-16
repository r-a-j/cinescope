import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MovieDetailModalComponent } from '../movie-detail-modal/movie-detail-modal.component';
import { MovieService } from 'src/services/movie.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit {
  movies: any[] = [];

  constructor(
    private http: HttpClient,
    private modalCtrl: ModalController,
    private movieService: MovieService
  ) { }

  ngOnInit() {
    this.fetchMovies();
  }

  fetchMovies() {
    const url = 'https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc';
    const options = {
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0M2YzZDM0N2IxNzU2YmUyMjI1MGY4MGQ1ODAyOTEwMSIsIm5iZiI6MTczNjczNDg1Ny42OTIsInN1YiI6IjY3ODQ3ODg5MjI1NjAyM2RmZDRlNjAyNSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KfGGPJNVAJfMUKgZOkZvP44qJI_Id8ZtgnK-YFz1p4Q'
      }
    };

    this.http.get<any>(url, options).subscribe(
      (data) => {
        this.movies = data.results;
      },
      (error) => {
        console.error('Error fetching movies:', error);
      }
    );
  }

  async openMovieDetails(movieId: number) {
    const modal = await this.modalCtrl.create({
      component: MovieDetailModalComponent,
      componentProps: { movieId }
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        if (result.data.action === 'watchlist') {
          this.movieService.addToWatchlist(result.data.movie);
        } else if (result.data.action === 'watched') {
          this.movieService.moveToWatched(result.data.movie);
        }
      }
    });

    await modal.present();
  }
}
