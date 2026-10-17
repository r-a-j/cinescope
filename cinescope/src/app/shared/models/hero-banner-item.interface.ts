export interface HeroBannerItem {
    id: number;
    mediaType?: 'movie' | 'tv';
    title: string;
    overview: string;
    backdropUrl: string;
    rating: number | string;
}