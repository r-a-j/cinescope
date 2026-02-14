import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'search',
    loadComponent: () => import('./search/search.page').then(m => m.SearchPage)
  },
  {
    path: 'setting',
    loadComponent: () => import('./setting/setting.page').then(m => m.SettingPage)
  },
  {
    path: 'movie-detail/:id',
    loadComponent: () => import('./movie-detail/movie-detail.page').then(m => m.MovieDetailPage)
  },
  {
    path: 'tv-detail/:id',
    loadComponent: () => import('./tv-detail/tv-detail.page').then(m => m.TvDetailPage)
  },
  {
    path: 'person-detail/:id',
    loadComponent: () => import('./pages/person-detail/person-detail.page').then(m => m.PersonDetailPage)
  },
  {
    path: 'view-all',
    loadComponent: () => import('./pages/generic-discover/generic-discover.page').then(m => m.GenericDiscoverPage)
  },
];
