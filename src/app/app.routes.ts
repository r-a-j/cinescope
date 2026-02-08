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
    path: 'top-rated-movies',
    loadComponent: () => import('./pages/generic-discover/generic-discover.page').then(m => m.GenericDiscoverPage),
    data: { title: 'Top Rated Movies', method: 'getTopRatedMovies', type: 'movie' }
  },
  {
    path: 'top-rated-tv',
    loadComponent: () => import('./pages/generic-discover/generic-discover.page').then(m => m.GenericDiscoverPage),
    data: { title: 'Top Rated TV', method: 'getTopRatedTV', type: 'tv' }
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
    path: 'bollywood-trending',
    loadComponent: () => import('./pages/generic-discover/generic-discover.page').then(m => m.GenericDiscoverPage),
    data: { title: 'Desi Trending', method: 'getTrendingBollywoodMovies', type: 'movie' }
  },
];
