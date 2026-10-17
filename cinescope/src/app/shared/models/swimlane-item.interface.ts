import { BookmarkState } from "../components/poster-card/poster-card.component";

export interface SwimlaneItem {
    id: string | number;
    mediaType?: 'movie' | 'tv' | 'person';
    title: string;
    subtitle?: string;
    posterUrl?: string;
    bookmarkState?: BookmarkState;
    payload?: Record<string, unknown>;
}