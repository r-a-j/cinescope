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
    redirectTo: 'tabs/settings',
    pathMatch: 'full'
  },
  // Feature Standalones
  {
    path: 'search',
    redirectTo: 'tabs/search',
    pathMatch: 'full'
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