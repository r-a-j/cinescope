import { Component } from '@angular/core';
import { DiscoverActorsPopularComponent } from '../discover-actors-popular/discover-actors-popular.component';

@Component({
  selector: 'app-discover-actors',
  templateUrl: './discover-actors.component.html',
  styleUrls: ['./discover-actors.component.scss'],
  imports: [DiscoverActorsPopularComponent],
  standalone: true,
})
export class DiscoverActorsComponent {
  constructor() { }
}
