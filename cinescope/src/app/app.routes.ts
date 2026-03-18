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
  }
];