export interface FranchisePart {
  id: number;
  title: string;
  mediaType?: 'movie' | 'tv' | undefined;
  overview?: string | undefined;
  poster_path?: string | null | undefined;
  backdrop_path?: string | null | undefined;
  release_date?: string | undefined;
  first_air_date?: string | undefined;
  vote_average?: number | undefined;
  vote_count?: number | undefined;
  importance?: 'essential' | 'recommended' | 'optional' | undefined;
}

export interface FranchiseUniverseCanonItem {
  title: string;
  year?: number | undefined;
  media_type?: 'movie' | 'tv' | undefined;
  importance?: 'essential' | 'recommended' | 'optional' | undefined;
  resolved?: boolean | undefined;
  tmdbId?: number | undefined;
  poster_path?: string | null | undefined;
  backdrop_path?: string | null | undefined;
  release_date?: string | undefined;
  overview?: string | undefined;
  vote_average?: number | undefined;
}

export interface FranchiseCollectionSummary {
  id: number | string;
  name: string;
  overview?: string | undefined;
  poster_path?: string | null | undefined;
  backdrop_path?: string | null | undefined;
  totalParts: number;
  releasedPartsCount?: number | undefined;
  upcomingPartsCount?: number | undefined;
  collectedCount: number;
  watchedCount: number;
  watchlistCount: number;
  completionPercentage: number;
  upNextPart?: FranchisePart | null | undefined;
  isUniverse?: boolean | undefined;
  universeId?: string | undefined;
  parentUniverseTitle?: string | undefined;
  connectionInsight?: string | undefined;
  parts?: FranchisePart[] | undefined;
  siblingFranchises?: { id: number; name: string }[] | undefined;
}

export interface FranchiseIntelResponse {
  isSharedUniverse: boolean;
  universeTitle?: string | undefined;
  universeId?: string | undefined;
  connectionInsight?: string | undefined;
  canonTitles?: {
    title: string;
    year?: number | undefined;
    media_type?: 'movie' | 'tv' | undefined;
    importance?: 'essential' | 'recommended' | 'optional' | undefined;
  }[] | undefined;
  siblingFranchises?: { id: number; name: string }[] | undefined;
  recommendedWatchOrder?: string[] | undefined;
}
