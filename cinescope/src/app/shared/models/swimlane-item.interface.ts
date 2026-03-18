import { BookmarkState } from "../components/poster-card/poster-card.component";

export interface SwimlaneItem {
    id: string | number;
    title: string;
    posterUrl?: string;
    bookmarkState?: BookmarkState;
}