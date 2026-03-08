import { TimelineService, TimelineNode } from './src/services/timeline.service';
import { ContentModel } from './src/models/content.model';

const service = new TimelineService();

const mockData: ContentModel[] = [
    { contentId: 1, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Single Node Day', watchedAt: '2023-11-01T14:30:00Z' },
    { contentId: 2, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 1 - Item 1', watchedAt: '2023-11-05T10:00:00Z' },
    { contentId: 3, isMovie: false, isTv: true, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 1 - Item 2', watchedAt: '2023-11-05T18:00:00Z' },
    { contentId: 4, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Single Node Day 2', watchedAt: '2023-11-10T20:45:00Z' },
    { contentId: 5, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 2 - Item 1', watchedAt: '2023-11-15T09:15:00Z' },
    { contentId: 6, isMovie: false, isTv: true, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 2 - Item 2', watchedAt: '2023-11-15T21:00:00Z' },
    { contentId: 7, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Stacked Node Day 2 - Item 3', watchedAt: '2023-11-15T23:59:00Z' },
    { contentId: 8, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Single Node Day 3', watchedAt: '2023-12-01T08:00:00Z' },
    { contentId: 9, isMovie: false, isTv: true, isWatched: true, isWatchlist: false, title: 'Single Node Day 4', watchedAt: '2024-01-01T14:00:00Z' },
    { contentId: 10, isMovie: true, isTv: false, isWatched: true, isWatchlist: false, title: 'Missing Date Item' }
];

const timeline: TimelineNode[] = service.generateTimeline(mockData);

console.log('=== Mock Timeline Output ===');
console.log(JSON.stringify(timeline, null, 2));
console.log('============================');
