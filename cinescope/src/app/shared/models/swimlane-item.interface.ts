import { BookmarkState } from "../components/poster-card/poster-card.component";

export interface SwimlaneItem {
    id: string | number;
    mediaType?: 'movie' | 'tv' | 'person' | undefined;
    title: string;
    subtitle?: string | undefined;
    posterUrl?: string | undefined;
    bookmarkState?: BookmarkState | undefined;
    payload?: Record<string, unknown> | undefined;
}