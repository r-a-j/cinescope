import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonIcon, IonButton, IonChip } from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { bookmark, star, calendarOutline, timeOutline, close } from 'ionicons/icons';

@Component({
  selector: 'app-movie-detail',
  templateUrl: './movie-detail.page.html',
  styleUrls: ['./movie-detail.page.scss'],
  standalone: true,
  imports: [
    IonChip,
    IonButton,
    IonIcon,
    IonContent,
    CommonModule,
    FormsModule],
})
export class MovieDetailPage implements OnInit {

  movieId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {
    addIcons({ calendarOutline, timeOutline, star, bookmark, close });
  }

  ngOnInit() {
    this.movieId = this.route.snapshot.paramMap.get('id');
    console.log('Movie ID:', this.movieId);
  }
}
