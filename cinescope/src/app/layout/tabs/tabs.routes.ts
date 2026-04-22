import { Routes } from '@angular/router';
import { TabsComponent } from './tabs.component';

export const routes: Routes = [
    {
        path: '',
        component: TabsComponent,
        children: [
            {
                path: 'pulse',
                loadComponent: () => import('../../features/discover/discover.page').then(m => m.DiscoverPage)
            },
            {
                path: 'oracle',
                loadComponent: () => import('../../features/movies/movies.page').then(m => m.MoviesPage)
            },
            {
                path: 'vault',
                loadComponent: () => import('../../features/archive/archive.page').then(m => m.ArchivePage)
            },
            {
                path: 'social',
                loadComponent: () => import('../../features/inbox/inbox.page').then(m => m.InboxPage)
            },
            {
                path: 'search',
                loadComponent: () => import('../../features/search/search.page').then(m => m.SearchPage)
            },
            {
                path: 'settings',
                loadComponent: () => import('../../features/settings/settings.page').then(m => m.SettingsPage)
            },
            {
                path: 'identity',
                loadComponent: () => import('../../features/identity/identity.page').then(m => m.IdentityPage)
            },
            {
                path: '',
                redirectTo: 'pulse',
                pathMatch: 'full'
            }
        ]
    }
];