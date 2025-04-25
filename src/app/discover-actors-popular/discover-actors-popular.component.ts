import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonSkeletonText } from '@ionic/angular/standalone';
import { PersonResult } from 'src/models/person.model';
import { TmdbSearchService } from 'src/services/tmdb-search.service';

@Component({
  selector: 'app-discover-actors-popular',
  templateUrl: './discover-actors-popular.component.html',
  styleUrls: ['./discover-actors-popular.component.scss'],
  imports: [CommonModule, IonSkeletonText],
  standalone: true,
})
export class DiscoverActorsPopularComponent  implements OnInit {
  popularPersons: PersonResult[] = [];
  isLoadingPersons = true;

  constructor(
    public router: Router,
    private tmdbService: TmdbSearchService,
  ) { }

  ngOnInit() {
    this.loadPopularPersons();
  }

  loadPopularPersons(): void {
    this.tmdbService.getPopularPersons(1).subscribe({
      next: (response) => {
        this.popularPersons = response.results;
        this.isLoadingPersons = false;
      },
      error: (error) => console.error(error)
    });
  }

  navigateToPersonDetail(id: number): void {
    this.router.navigate(['/person-detail', id]);
  }
}
