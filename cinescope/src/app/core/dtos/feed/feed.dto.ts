export interface FeedItem {
    title?: string;
    link?: string;
    pubDate?: string;
    creator?: string;
    contentSnippet?: string;
    image?: string;
    sourceName: string;
    sourceUrl: string;
}

export interface FeedResponseDto {
    status: 'ok' | 'error';
    items: FeedItem[];
    errors?: string[];
}
