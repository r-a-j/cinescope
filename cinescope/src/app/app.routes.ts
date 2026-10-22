import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tabs',
    loadChildren: () => import('./layout/tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: '',
    redirectTo: 'tabs/discover', // The moment they open the app, go to Discover
    pathMatch: 'full',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
  },
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.page').then( m => m.SearchPage)
  },
  {
    path: 'media/:mediaType/:id',
    loadComponent: () => import('./features/media-detail/media-detail.page').then(m => m.MediaDetailPage)
  },
  {
    path: 'person/:id',
    loadComponent: () => import('./features/person-detail/person-detail.page').then(m => m.PersonDetailPage)
  },
  {
    path: 'collection',
    loadComponent: () => import('./features/collection/collection.page').then(m => m.CollectionPage)
  },
  {
    path: 'collection/:id',
    loadComponent: () => import('./features/collection/collection.page').then(m => m.CollectionPage)
  }
];
