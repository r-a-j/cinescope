export type AppTourId = 'app' | 'discover' | 'movies' | 'tv' | 'archive' | 'franchise' | 'franchise-merge' | 'inbox' | 'search';

export interface AppTourStep {
    route: string;
    target: string;
    title: string;
    description: string;
}

export interface AppTourDefinition {
    id: AppTourId;
    label: string;
    description: string;
    steps: AppTourStep[];
}

export interface AppTourCategory {
    id: 'discover' | 'library' | 'recommendations';
    label: string;
    description: string;
    icon: string;
    tutorials: AppTourDefinition[];
}

const discoverSteps: AppTourStep[] = [
    {
        route: '/tabs/discover',
        target: 'discover-sections',
        title: 'Choose a discovery section',
        description: 'Switch between trending titles, regional cinema, Bollywood, top-rated picks, actors, and entertainment news.'
    },
    {
        route: '/tabs/discover',
        target: 'discover-feed',
        title: 'Explore the catalog',
        description: 'Browse featured titles and curated rows. Tap any poster to open its details and save it to your library.'
    }
];

const moviesSteps: AppTourStep[] = [
    {
        route: '/tabs/movies',
        target: 'movies-page',
        title: 'Your movie hub',
        description: 'Find a movie with CineMatch, reveal a Blind Ticket from your watchlist, and follow franchises in progress. Some sections appear as your library grows.'
    }
];

const tvSteps: AppTourStep[] = [
    {
        route: '/tabs/tv',
        target: 'tv-page',
        title: 'TV shows',
        description: 'Track your series, mark episodes watched, use the Binge Sizer to find your next show, and check the weekly air radar.'
    }
];

const archiveSteps: AppTourStep[] = [
    {
        route: '/tabs/archive',
        target: 'archive-filters',
        title: 'Organize your library',
        description: 'Switch between your watchlist, watched titles, franchises, and favorite people.'
    },
    {
        route: '/tabs/archive',
        target: 'archive-library',
        title: 'Your saved titles',
        description: 'Filter and browse saved titles here. Your library is stored on this device and remains available offline.'
    }
];

const franchiseSteps: AppTourStep[] = [
    {
        route: '/tabs/archive?tour=franchise',
        target: 'archive-franchises-tab',
        title: 'Open your Franchises shelf',
        description: 'Archive keeps your Watchlist, Watched titles, Franchises, and favorite people. The tutorial opens Franchises for you.'
    },
    {
        route: '/tabs/archive?tour=franchise',
        target: 'archive-franchise-library',
        title: 'Your sagas and universes',
        description: 'Tracked sagas show watched progress and what to watch next. If this shelf is empty, use Search Franchises & Universes to find a collection, then choose Track Saga.'
    },
    {
        route: '/search',
        target: 'search-input',
        title: 'Find a saga to follow',
        description: 'Search for a film series or collection, open it, and choose Track Saga. Your tracked sagas then appear in Archive and Movies.'
    }
];

const franchiseMergeSteps: AppTourStep[] = [
    {
        route: '/tabs/archive?tour=franchise-merge',
        target: 'archive-franchise-library',
        title: 'Find a saga to organize',
        description: 'Universe merge tools are available from a saga that CineScope recognizes as part of a tracked universe.'
    },
    {
        route: '/search',
        target: 'search-input',
        title: 'Set up a shared universe first',
        description: 'Search for a saga, open its collection, and use AI Universe to review and create a shared universe. Then replay this tutorial to learn how to merge or unmerge it.'
    }
];

const inboxSteps: AppTourStep[] = [
    {
        route: '/tabs/inbox',
        target: 'inbox-import',
        title: 'Collect recommendations',
        description: 'Import text, notes, or screenshots. CineScope finds movie and series titles and adds them to your review queue.'
    },
    {
        route: '/tabs/inbox',
        target: 'inbox-queue',
        title: 'Triage your queue',
        description: 'Review recommendations in the swipe deck or switch to the batch list. Save titles to your watchlist, mark them watched, or discard them.'
    }
];

const searchSteps: AppTourStep[] = [
    {
        route: '/search',
        target: 'search-input',
        title: 'Search your way',
        description: 'Search by title, person, or collection. For a natural-language request, try Smart Search—for example, “mind-bending sci-fi near a black hole”.'
    }
];

const settingsSteps: AppTourStep[] = [
    {
        route: '/settings',
        target: 'settings-tutorials',
        title: 'Replay a tutorial anytime',
        description: 'Return here whenever you need a refresher. Tutorials are grouped by task; expand a category and choose a focused walkthrough.'
    }
];

const appSteps: AppTourStep[] = [
    {
        route: '/tabs/discover',
        target: 'header-search',
        title: 'Search is always close',
        description: 'Open Search from this shortcut on the main sections, then look up a title or ask Smart Search in your own words.'
    },
    ...discoverSteps,
    {
        route: '/tabs/movies',
        target: 'tab-movies',
        title: 'Movies',
        description: 'The Movies tab brings together personalized picks, your watchlist’s Blind Ticket, and franchise progress.'
    },
    ...moviesSteps,
    {
        route: '/tabs/tv',
        target: 'tab-tv',
        title: 'TV',
        description: 'Track your series, mark episodes watched, use the Binge Sizer to find your next show, and check the weekly air radar.'
    },
    ...tvSteps,
    {
        route: '/tabs/archive',
        target: 'tab-archive',
        title: 'Archive',
        description: 'Your saved library and watch history live in Archive.'
    },
    ...archiveSteps,
    {
        route: '/tabs/inbox',
        target: 'tab-inbox',
        title: 'Inbox',
        description: 'Gather recommendations from messages or screenshots, then review them at your own pace.'
    },
    ...inboxSteps,
    ...searchSteps,
    ...settingsSteps
];

export const APP_TOURS: Record<AppTourId, AppTourDefinition> = {
    app: {
        id: 'app',
        label: 'Full App Tour',
        description: 'Visit the main sections and learn the key shortcuts.',
        steps: appSteps
    },
    discover: {
        id: 'discover',
        label: 'Discover',
        description: 'Trending, curated feeds, and regional cinema.',
        steps: discoverSteps
    },
    movies: {
        id: 'movies',
        label: 'Movies',
        description: 'Personalized picks and franchise tracking.',
        steps: moviesSteps
    },
    tv: {
        id: 'tv',
        label: 'TV',
        description: 'Track series progress, find a show to binge, and keep up with upcoming episodes.',
        steps: tvSteps
    },
    archive: {
        id: 'archive',
        label: 'Archive',
        description: 'Manage your watchlist, watched titles, and more.',
        steps: archiveSteps
    },
    franchise: {
        id: 'franchise',
        label: 'Franchise Tracker',
        description: 'Track sagas, follow watch order, and understand progress and universes.',
        steps: franchiseSteps
    },
    'franchise-merge': {
        id: 'franchise-merge',
        label: 'Universe Merge & Unmerge',
        description: 'Fold related sagas together in Archive without changing the universe canon.',
        steps: franchiseMergeSteps
    },
    inbox: {
        id: 'inbox',
        label: 'Inbox',
        description: 'Import and triage recommendations.',
        steps: inboxSteps
    },
    search: {
        id: 'search',
        label: 'Search',
        description: 'Find titles with regular or AI-powered search.',
        steps: searchSteps
    }
};

export const APP_TOUR_MODULES: AppTourDefinition[] = [
    APP_TOURS.discover,
    APP_TOURS.movies,
    APP_TOURS.tv,
    APP_TOURS.archive,
    APP_TOURS.franchise,
    APP_TOURS['franchise-merge'],
    APP_TOURS.inbox,
    APP_TOURS.search
];

export const APP_TOUR_CATEGORIES: AppTourCategory[] = [
    {
        id: 'discover',
        label: 'Explore & Discover',
        description: 'Browse titles and find your next watch.',
        icon: 'compass-outline',
        tutorials: [APP_TOURS.discover, APP_TOURS.movies, APP_TOURS.tv, APP_TOURS.search]
    },
    {
        id: 'library',
        label: 'Your Library',
        description: 'Save titles, track sagas, and follow watch progress.',
        icon: 'albums-outline',
        tutorials: [APP_TOURS.archive, APP_TOURS.franchise, APP_TOURS['franchise-merge']]
    },
    {
        id: 'recommendations',
        label: 'Recommendations',
        description: 'Collect suggestions and review them later.',
        icon: 'mail-outline',
        tutorials: [APP_TOURS.inbox]
    }
];
