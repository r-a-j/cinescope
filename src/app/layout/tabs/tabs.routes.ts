import { Routes } from '@angular/router';
import { TabsComponent } from './tabs.component';

export const routes: Routes = [
    {
        path: '',
        component: TabsComponent,
        children: [
            {
                path: 'movies',
                loadComponent: () => import('../../features/movies/movies.page').then(m => m.MoviesPage)
            },
            {
                path: 'tv',
                loadComponent: () => import('../../features/tv/tv.page').then(m => m.TvPage)
            },
            {
                path: 'discover',
                loadComponent: () => import('../../features/discover/discover.page').then(m => m.DiscoverPage)
            },
            {
                path: 'archive',
                loadComponent: () => import('../../features/archive/archive.page').then(m => m.ArchivePage)
            },
            {
                path: 'inbox',
                loadComponent: () => import('../../features/inbox/inbox.page').then(m => m.InboxPage)
            },
            {
                path: '',
                redirectTo: 'discover',
                pathMatch: 'full'
            }
        ]
    }
];