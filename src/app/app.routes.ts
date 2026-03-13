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
];