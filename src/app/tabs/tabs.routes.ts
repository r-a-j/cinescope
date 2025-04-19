import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'movie',
        loadComponent: () =>
          import('../movie/movie.page').then((m) => m.MoviePage),
      },
      {
        path: 'tv',
        loadComponent: () =>
          import('../tv/tv.page').then((m) => m.TvPage),
      },
      {
        path: 'discover',
        loadComponent: () =>
          import('../discover/discover.page').then((m) => m.DiscoverPage),
      },
      {
        path: '',
        redirectTo: '/tabs/movie',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/movie',
    pathMatch: 'full',
  },
];
