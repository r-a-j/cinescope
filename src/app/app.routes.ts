import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'search',
    loadComponent: () => import('./search/search.page').then( m => m.SearchPage)
  },
  {
    path: 'setting',
    loadComponent: () => import('./setting/setting.page').then( m => m.SettingPage)
  },
  {
    path: 'top-rated-movies',
    loadComponent: () => import('./top-rated-movies/top-rated-movies.page').then( m => m.TopRatedMoviesPage)
  },
  {
    path: 'top-rated-tv',
    loadComponent: () => import('./top-rated-tv/top-rated-tv.page').then( m => m.TopRatedTvPage)
  },
  {
    path: 'movie-detail/:id',
    loadComponent: () => import('./movie-detail/movie-detail.page').then( m => m.MovieDetailPage)
  },
  {
    path: 'tv-detail/:id',
    loadComponent: () => import('./tv-detail/tv-detail.page').then( m => m.TvDetailPage)
  },
];
