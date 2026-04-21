export interface FeedItem {
    title: string;
    pubDate: string;
    link: string;
    thumbnail: string;
    sourceName?: string;
    description: string;
    content?: string;
    author: string;
    enclosure?: { link: string; type: string }; // Where some sites hide images
    extractedImage?: string; // Our final, unified image URL
}

export interface Rss2JsonResult {
    status: string;
    feed: { title: string; link: string; };
    items: FeedItem[];
}