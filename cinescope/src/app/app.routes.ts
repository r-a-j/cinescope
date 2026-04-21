import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tabs',
    loadChildren: () => import('./layout/tabs/tabs.routes').then((m) => m.routes),
  },
  // Legacy & Root Redirects
  {
    path: 'discover',
    redirectTo: 'tabs/pulse',
    pathMatch: 'full'
  },
  {
    path: 'movies',
    redirectTo: 'tabs/oracle',
    pathMatch: 'full'
  },
  {
    path: 'tv',
    redirectTo: 'tabs/oracle',
    pathMatch: 'full'
  },
  {
    path: 'archive',
    redirectTo: 'tabs/vault',
    pathMatch: 'full'
  },
  {
    path: 'inbox',
    redirectTo: 'tabs/social',
    pathMatch: 'full'
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage)
  },
  // Feature Standalones
  {
    path: 'search',
    loadComponent: () => import('./features/search/search.page').then(m => m.SearchPage)
  },
  // Fallbacks
  {
    path: '',
    redirectTo: 'tabs/pulse',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'tabs/pulse'
  }
];