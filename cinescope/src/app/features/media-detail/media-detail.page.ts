import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  IonContent,
  IonSkeletonText,
  NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  shareSocialOutline,
  bookmarkOutline,
  bookmark,
  checkmarkCircleOutline,
  checkmarkCircle,
  playOutline,
  playCircleOutline,
  star,
  timeOutline,
  calendarOutline,
  tvOutline,
  filmOutline,
  globeOutline,
  openOutline,
  closeOutline,
  sparklesOutline,
  peopleOutline,
  cashOutline,
  layersOutline,
  chatboxEllipsesOutline,
  pricetagOutline
} from 'ionicons/icons';

import { TmdbMoviesService } from '../../core/services/tmdb-movies.service';
import { TmdbTvService } from '../../core/services/tmdb-tv.service';
import { TmdbTvSeasonsService } from '../../core/services/tmdb-tv-seasons.service';
import { StorageService, TmdbPayload } from '../../core/services/storage.service';
import { ToastService } from '../../core/services/toast.service';
import { resolveMediaImageUrl } from '../../core/constants/api.constants';

import { TmdbMovieDetailDto } from '../../core/dtos/movies/movie-detail.dto';
import { TmdbTvDetailDto, TmdbTvEpisodeBaseDto, TmdbTvSeasonBaseDto, TmdbTvNetworkDto } from '../../core/dtos/tv/tv-detail.dto';
import { TmdbMovieCreditsResponseDto } from '../../core/dtos/movies/movie-credits.dto';
import { TmdbTvAggregateCreditsResponseDto } from '../../core/dtos/tv/tv-aggregate-credits.dto';
import { TmdbVideoDto } from '../../core/dtos/common/video.dto';
import { TmdbWatchProviderDto, TmdbWatchProviderRegionDto } from '../../core/dtos/watch-providers/watch-provider.dto';
import { TmdbReleaseDateGroupDto } from '../../core/dtos/movies/movie-release-dates.dto';
import { TmdbTvContentRatingDto } from '../../core/dtos/tv/tv-content-ratings.dto';
import { TmdbKeywordDto } from '../../core/dtos/keywords/keyword.dto';
import { TmdbReviewDto } from '../../core/dtos/reviews/review.dto';
import { TmdbMovieListItemDto } from '../../core/dtos/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../../core/dtos/tv/tv-list-item.dto';
import { TmdbTvSeasonDetailDto, TmdbTvSeasonEpisodeDto } from '../../core/dtos/tv-seasons/tv-season-detail.dto';
import { SwimlaneComponent } from '../../shared/components/swimlane/swimlane.component';
import { SwimlaneItem } from '../../shared/models/swimlane-item.interface';
import { BookmarkState } from '../../shared/components/poster-card/poster-card.component';

import { DetailHeroComponent } from './components/detail-hero/detail-hero.component';
import { WatchProvidersPanelComponent } from './components/watch-providers-panel/watch-providers-panel.component';
import { TvSeasonsHubComponent } from './components/tv-seasons-hub/tv-seasons-hub.component';
import { CastVideoGalleryComponent } from './components/cast-video-gallery/cast-video-gallery.component';
import { ProductionReviewsPanelComponent } from './components/production-reviews-panel/production-reviews-panel.component';

export interface CastMemberVm {
  id: number;
  name: string;
  character: string;
  profileUrl: string;
  episodeCount?: number | undefined;
}

export interface CrewSpotlightVm {
  role: string;
  names: string;
}

export interface ExternalLinkVm {
  label: string;
  url: string;
  icon: string;
}

export interface MediaPreviewState {
  id?: number | undefined;
  mediaType?: 'movie' | 'tv' | undefined;
  title?: string | undefined;
  overview?: string | undefined;
  posterUrl?: string | undefined;
  backdropUrl?: string | undefined;
  releaseYear?: string | undefined;
  rating?: number | string | undefined;
}

const PREFERRED_REGIONS = ['IN', 'DE', 'US', 'GB', 'CA', 'AU'];

@Component({
  selector: 'app-media-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonSkeletonText,
    SwimlaneComponent,
    DetailHeroComponent,
    WatchProvidersPanelComponent,
    TvSeasonsHubComponent,
    CastVideoGalleryComponent,
    ProductionReviewsPanelComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-detail.page.html',
  styleUrls: ['./media-detail.page.scss']
})
export class MediaDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private moviesService = inject(TmdbMoviesService);
  private tvService = inject(TmdbTvService);
  private tvSeasonsService = inject(TmdbTvSeasonsService);
  public storage = inject(StorageService);
  private toast = inject(ToastService);

  private castVideoGallery = viewChild(CastVideoGalleryComponent);

  public mediaType = signal<'movie' | 'tv'>('movie');
  public tmdbId = signal<number>(0);

  public isLoading = signal<boolean>(true);
  public error = signal<string | null>(null);

  // Instant Frame-0 preview state from router state or local RxDB archive
  public preview = signal<MediaPreviewState | null>(null);

  // Full API payloads
  public movieDetail = signal<TmdbMovieDetailDto | null>(null);
  public tvDetail = signal<TmdbTvDetailDto | null>(null);

  // Watch Providers region selection
  public selectedWatchRegion = signal<string>('IN');

  // TV Season & Episode Explorer state
  public selectedSeasonNumber = signal<number>(1);
  public seasonDetailsMap = signal<Record<number, TmdbTvSeasonDetailDto>>({});
  public isSeasonLoading = signal<boolean>(false);

  public overviewExpanded = signal<boolean>(false);

  // ==========================================
  // ⚡ COMPUTED VIEW MODELS
  // ==========================================

  public bookmarkState = computed<BookmarkState>(() => {
    const id = this.tmdbId();
    const type = this.mediaType();
    if (!id) return 'none';
    return this.storage.getBookmarkState(id, type);
  });

  public title = computed<string>(() => {
    const m = this.movieDetail();
    if (m) return m.title;
    const t = this.tvDetail();
    if (t) return t.name;
    return this.preview()?.title || 'Loading...';
  });

  public originalTitle = computed<string | null>(() => {
    const m = this.movieDetail();
    if (m && m.original_title && m.original_title.toLowerCase() !== m.title.toLowerCase()) {
      return m.original_title;
    }
    const t = this.tvDetail();
    if (t && t.original_name && t.original_name.toLowerCase() !== t.name.toLowerCase()) {
      return t.original_name;
    }
    return null;
  });

  public tagline = computed<string | null>(() => {
    const tag = this.movieDetail()?.tagline || this.tvDetail()?.tagline || '';
    return tag.trim().length > 0 ? tag.trim() : null;
  });

  public overview = computed<string>(() => {
    const text = this.movieDetail()?.overview || this.tvDetail()?.overview || this.preview()?.overview || '';
    return text.trim() || 'No synopsis available yet.';
  });

  public posterUrl = computed<string>(() => {
    const path = this.movieDetail()?.poster_path ?? this.tvDetail()?.poster_path;
    if (path) return resolveMediaImageUrl(path, 'w500');
    return this.preview()?.posterUrl || 'assets/placeholders/placeholder.webp';
  });

  public backdropUrl = computed<string>(() => {
    const path = this.movieDetail()?.backdrop_path ?? this.tvDetail()?.backdrop_path;
    if (path) return resolveMediaImageUrl(path, 'w1280');
    const prevBackdrop = this.preview()?.backdropUrl;
    if (prevBackdrop) return prevBackdrop;
    return this.posterUrl();
  });

  public releaseYearLabel = computed<string>(() => {
    const m = this.movieDetail();
    if (m?.release_date) return m.release_date.slice(0, 4);
    const t = this.tvDetail();
    if (t?.first_air_date) {
      const startYear = t.first_air_date.slice(0, 4);
      const endYear = t.last_air_date ? t.last_air_date.slice(0, 4) : '';
      if (t.status === 'Ended' || t.status === 'Canceled') {
        return endYear && endYear !== startYear ? `${startYear}–${endYear}` : startYear;
      }
      return `${startYear}–Present`;
    }
    return this.preview()?.releaseYear || '';
  });

  public runtimeLabel = computed<string | null>(() => {
    const m = this.movieDetail();
    if (m?.runtime && m.runtime > 0) {
      const hrs = Math.floor(m.runtime / 60);
      const mins = m.runtime % 60;
      return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }
    const t = this.tvDetail();
    if (t) {
      const parts: string[] = [];
      if (t.number_of_seasons > 0) {
        parts.push(`${t.number_of_seasons} ${t.number_of_seasons === 1 ? 'Season' : 'Seasons'}`);
      }
      if (t.number_of_episodes > 0) {
        parts.push(`${t.number_of_episodes} Eps`);
      }
      const avgRun = t.episode_run_time?.[0];
      if (avgRun && avgRun > 0) {
        parts.push(`~${avgRun}m/ep`);
      }
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    return null;
  });

  public ratingValue = computed<string | null>(() => {
    const vote = this.movieDetail()?.vote_average ?? this.tvDetail()?.vote_average;
    if (typeof vote === 'number' && vote > 0) {
      return vote.toFixed(1);
    }
    const prev = this.preview()?.rating;
    if (prev && prev !== 'NR' && prev !== '0') {
      return String(prev);
    }
    return null;
  });

  public voteCountLabel = computed<string | null>(() => {
    const count = this.movieDetail()?.vote_count ?? this.tvDetail()?.vote_count ?? 0;
    if (!count || count <= 0) return null;
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return String(count);
  });

  public statusLabel = computed<string | null>(() => {
    return this.movieDetail()?.status || this.tvDetail()?.status || null;
  });

  public certification = computed<string | null>(() => {
    const m = this.movieDetail();
    if (m) {
      const relDates = m['release_dates'] as { results?: TmdbReleaseDateGroupDto[] } | undefined;
      const groups = relDates?.results || [];
      for (const region of PREFERRED_REGIONS) {
        const group = groups.find((g) => g.iso_3166_1 === region);
        const cert = group?.release_dates?.find((r) => r.certification && r.certification.trim().length > 0)?.certification;
        if (cert) return cert.trim();
      }
      const fallback = groups
        .flatMap((g) => g.release_dates || [])
        .find((r) => r.certification && r.certification.trim().length > 0)?.certification;
      return fallback ? fallback.trim() : null;
    }

    const t = this.tvDetail();
    if (t) {
      const ratingsObj = t['content_ratings'] as { results?: TmdbTvContentRatingDto[] } | undefined;
      const list = ratingsObj?.results || [];
      for (const region of PREFERRED_REGIONS) {
        const match = list.find((r) => r.iso_3166_1 === region && r.rating?.trim());
        if (match) return match.rating.trim();
      }
      return list.find((r) => r.rating?.trim())?.rating.trim() || null;
    }

    return null;
  });

  public genres = computed<string[]>(() => {
    const g = this.movieDetail()?.genres ?? this.tvDetail()?.genres ?? [];
    return g.map((item) => item.name);
  });

  // ==========================================
  // 🎬 VIDEOS & OFFICIAL TRAILER
  // ==========================================
  public videos = computed<TmdbVideoDto[]>(() => {
    const raw = (this.movieDetail()?.['videos'] ?? this.tvDetail()?.['videos']) as { results?: TmdbVideoDto[] } | undefined;
    const list = (raw?.results || []).filter((v) => v.site === 'YouTube' && v.key);
    const typePriority: Record<string, number> = {
      Trailer: 1,
      Teaser: 2,
      Clip: 3,
      Featurette: 4,
      'Behind the Scenes': 5,
      Recap: 6
    };
    return [...list].sort((a, b) => {
      if (a.official !== b.official) return a.official ? -1 : 1;
      const pa = typePriority[a.type] ?? 99;
      const pb = typePriority[b.type] ?? 99;
      return pa - pb;
    });
  });

  public officialTrailer = computed<TmdbVideoDto | null>(() => {
    const vids = this.videos();
    return vids.find((v) => v.type === 'Trailer') ?? vids[0] ?? null;
  });

  // ==========================================
  // 📺 WHERE TO STREAM / RENT / BUY
  // ==========================================
  public watchProvidersMap = computed<Record<string, TmdbWatchProviderRegionDto>>(() => {
    const raw = (this.movieDetail()?.['watch/providers'] ?? this.tvDetail()?.['watch/providers']) as
      | { results?: Record<string, TmdbWatchProviderRegionDto> }
      | undefined;
    return raw?.results || {};
  });

  public availableWatchRegions = computed<string[]>(() => {
    const map = this.watchProvidersMap();
    const keys = Object.keys(map);
    if (keys.length === 0) return [];
    const prioritized = PREFERRED_REGIONS.filter((r) => keys.includes(r));
    const others = keys.filter((k) => !PREFERRED_REGIONS.includes(k)).slice(0, 6);
    return [...prioritized, ...others];
  });

  public activeWatchRegionData = computed<TmdbWatchProviderRegionDto | null>(() => {
    const map = this.watchProvidersMap();
    const sel = this.selectedWatchRegion();
    if (map[sel]) return map[sel];
    const first = this.availableWatchRegions()[0];
    return first ? map[first] : null;
  });

  public streamingProviders = computed<TmdbWatchProviderDto[]>(() => {
    const data = this.activeWatchRegionData();
    if (!data) return [];
    const combined = [...(data.flatrate || []), ...(data.free || []), ...(data.ads || [])];
    const seen = new Set<number>();
    return combined.filter((p) => {
      if (seen.has(p.provider_id)) return false;
      seen.add(p.provider_id);
      return true;
    });
  });

  public rentProviders = computed<TmdbWatchProviderDto[]>(() => {
    return this.activeWatchRegionData()?.rent || [];
  });

  public buyProviders = computed<TmdbWatchProviderDto[]>(() => {
    return this.activeWatchRegionData()?.buy || [];
  });

  public tvNetworks = computed<TmdbTvNetworkDto[]>(() => {
    return this.tvDetail()?.networks || [];
  });

  // ==========================================
  // 🎭 CAST & FILMMAKERS / CREATORS
  // ==========================================
  public castList = computed<CastMemberVm[]>(() => {
    const m = this.movieDetail();
    if (m) {
      const credits = m['credits'] as TmdbMovieCreditsResponseDto | undefined;
      return (credits?.cast || []).slice(0, 20).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character || 'Actor',
        profileUrl: resolveMediaImageUrl(c.profile_path, 'w185')
      }));
    }

    const t = this.tvDetail();
    if (t) {
      const agg = t['aggregate_credits'] as TmdbTvAggregateCreditsResponseDto | undefined;
      if (agg?.cast && agg.cast.length > 0) {
        const sorted = [...agg.cast].sort((a, b) => (b.total_episode_count || 0) - (a.total_episode_count || 0));
        return sorted.slice(0, 20).map((c) => ({
          id: c.id,
          name: c.name,
          character: c.roles?.[0]?.character || 'Series Regular',
          profileUrl: resolveMediaImageUrl(c.profile_path, 'w185'),
          episodeCount: c.total_episode_count
        }));
      }
      const std = t['credits'] as TmdbMovieCreditsResponseDto | undefined;
      return (std?.cast || []).slice(0, 20).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character || 'Actor',
        profileUrl: resolveMediaImageUrl(c.profile_path, 'w185')
      }));
    }

    return [];
  });

  public crewSpotlights = computed<CrewSpotlightVm[]>(() => {
    const items: CrewSpotlightVm[] = [];
    const m = this.movieDetail();
    if (m) {
      const credits = m['credits'] as TmdbMovieCreditsResponseDto | undefined;
      const crew = credits?.crew || [];
      const directors = [...new Set(crew.filter((c) => c.job === 'Director').map((c) => c.name))];
      const writers = [
        ...new Set(
          crew
            .filter((c) => c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story')
            .map((c) => c.name)
        )
      ];
      const composers = [
        ...new Set(
          crew.filter((c) => c.job === 'Original Music Composer' || c.job === 'Music').map((c) => c.name)
        )
      ];
      const cinematographers = [
        ...new Set(crew.filter((c) => c.job === 'Director of Photography').map((c) => c.name))
      ];

      if (directors.length > 0) items.push({ role: 'Director', names: directors.slice(0, 3).join(', ') });
      if (writers.length > 0) items.push({ role: 'Writers', names: writers.slice(0, 3).join(', ') });
      if (composers.length > 0) items.push({ role: 'Music', names: composers.slice(0, 2).join(', ') });
      if (cinematographers.length > 0) items.push({ role: 'Cinematography', names: cinematographers.slice(0, 2).join(', ') });
    }

    const t = this.tvDetail();
    if (t) {
      if (t.created_by && t.created_by.length > 0) {
        items.push({
          role: 'Created By',
          names: t.created_by.map((c) => c.name).join(', ')
        });
      }
      if (t.type) {
        items.push({ role: 'Format', names: t.type });
      }
    }

    return items;
  });

  // ==========================================
  // 📺 TV SEASONS & EPISODES HUB
  // ==========================================
  public tvSeasons = computed<TmdbTvSeasonBaseDto[]>(() => {
    const seasons = this.tvDetail()?.seasons || [];
    const main = seasons.filter((s) => s.season_number > 0);
    const specials = seasons.filter((s) => s.season_number === 0 && s.episode_count > 0);
    return [...main, ...specials];
  });

  public activeSeasonDetail = computed<TmdbTvSeasonDetailDto | null>(() => {
    const num = this.selectedSeasonNumber();
    return this.seasonDetailsMap()[num] ?? null;
  });

  public activeSeasonEpisodes = computed<TmdbTvSeasonEpisodeDto[]>(() => {
    return this.activeSeasonDetail()?.episodes || [];
  });

  public lastEpisodeToAir = computed<TmdbTvEpisodeBaseDto | null>(() => {
    return this.tvDetail()?.last_episode_to_air ?? null;
  });

  public nextEpisodeToAir = computed<TmdbTvEpisodeBaseDto | null>(() => {
    return this.tvDetail()?.next_episode_to_air ?? null;
  });

  // ==========================================
  // 💰 FACTS, KEYWORDS, REVIEWS & LINKS
  // ==========================================
  public productionFacts = computed<{ label: string; value: string }[]>(() => {
    const facts: { label: string; value: string }[] = [];
    const m = this.movieDetail();
    const t = this.tvDetail();

    if (m) {
      if (m.release_date) {
        facts.push({ label: 'Release Date', value: m.release_date });
      }
      if (m.budget && m.budget > 0) {
        facts.push({ label: 'Budget', value: this.formatCurrency(m.budget) });
      }
      if (m.revenue && m.revenue > 0) {
        facts.push({ label: 'Box Office', value: this.formatCurrency(m.revenue) });
      }
    }

    if (t) {
      if (t.first_air_date) {
        facts.push({ label: 'First Aired', value: t.first_air_date });
      }
      if (t.last_air_date) {
        facts.push({ label: 'Last Aired', value: t.last_air_date });
      }
    }

    const langs = m?.spoken_languages ?? t?.spoken_languages ?? [];
    if (langs.length > 0) {
      facts.push({
        label: 'Languages',
        value: langs
          .map((l) => l.english_name || l.name)
          .slice(0, 3)
          .join(', ')
      });
    }

    const countries = m?.production_countries ?? t?.production_countries ?? [];
    if (countries.length > 0) {
      facts.push({
        label: 'Country',
        value: countries
          .map((c) => c.name)
          .slice(0, 2)
          .join(', ')
      });
    }

    const studios = m?.production_companies ?? t?.production_companies ?? [];
    if (studios.length > 0) {
      facts.push({
        label: 'Studios',
        value: studios
          .map((s) => s.name)
          .slice(0, 3)
          .join(', ')
      });
    }

    return facts;
  });

  public keywords = computed<TmdbKeywordDto[]>(() => {
    const m = this.movieDetail();
    if (m) {
      const kw = m['keywords'] as { keywords?: TmdbKeywordDto[] } | undefined;
      return (kw?.keywords || []).slice(0, 16);
    }
    const t = this.tvDetail();
    if (t) {
      const kw = t['keywords'] as { results?: TmdbKeywordDto[] } | undefined;
      return (kw?.results || []).slice(0, 16);
    }
    return [];
  });

  public reviews = computed<TmdbReviewDto[]>(() => {
    const raw = (this.movieDetail()?.['reviews'] ?? this.tvDetail()?.['reviews']) as
      | { results?: TmdbReviewDto[] }
      | undefined;
    return (raw?.results || []).slice(0, 5);
  });

  public externalLinks = computed<ExternalLinkVm[]>(() => {
    const links: ExternalLinkVm[] = [];
    const ext = (this.movieDetail()?.['external_ids'] ?? this.tvDetail()?.['external_ids']) as
      | Record<string, string | number | null>
      | undefined;
    const imdbId = (ext?.['imdb_id'] as string | null) || this.movieDetail()?.imdb_id || null;
    if (imdbId) {
      links.push({
        label: 'IMDb',
        url: `https://www.imdb.com/title/${imdbId}/`,
        icon: 'film-outline'
      });
    }
    const homepage = this.movieDetail()?.homepage || this.tvDetail()?.homepage;
    if (homepage && homepage.startsWith('http')) {
      links.push({
        label: 'Official Site',
        url: homepage,
        icon: 'globe-outline'
      });
    }
    const insta = ext?.['instagram_id'] as string | null;
    if (insta) {
      links.push({
        label: 'Instagram',
        url: `https://www.instagram.com/${insta}/`,
        icon: 'open-outline'
      });
    }
    const twitter = ext?.['twitter_id'] as string | null;
    if (twitter) {
      links.push({
        label: 'X / Twitter',
        url: `https://x.com/${twitter}`,
        icon: 'open-outline'
      });
    }
    return links;
  });

  // ==========================================
  // 🎞️ RECOMMENDATIONS & SIMILAR SWIMLANES
  // ==========================================
  public recommendationsSwimlane = computed<SwimlaneItem[]>(() => {
    return this.extractSwimlaneList('recommendations');
  });

  public similarSwimlane = computed<SwimlaneItem[]>(() => {
    return this.extractSwimlaneList('similar');
  });

  constructor() {
    addIcons({
      arrowBackOutline,
      shareSocialOutline,
      bookmarkOutline,
      bookmark,
      checkmarkCircleOutline,
      checkmarkCircle,
      playOutline,
      playCircleOutline,
      star,
      timeOutline,
      calendarOutline,
      tvOutline,
      filmOutline,
      globeOutline,
      openOutline,
      closeOutline,
      sparklesOutline,
      peopleOutline,
      cashOutline,
      layersOutline,
      chatboxEllipsesOutline,
      pricetagOutline
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const typeParam = params.get('mediaType');
      const idParam = Number(params.get('id'));
      const validType: 'movie' | 'tv' = typeParam === 'tv' ? 'tv' : 'movie';

      if (!idParam || Number.isNaN(idParam)) {
        this.error.set('Invalid media ID.');
        this.isLoading.set(false);
        return;
      }

      this.mediaType.set(validType);
      this.tmdbId.set(idParam);
      this.hydratePreviewState(idParam, validType);
      void this.loadFullDetails(idParam, validType);
    });
  }

  private hydratePreviewState(id: number, type: 'movie' | 'tv'): void {
    const navState = history.state as { preview?: MediaPreviewState } | undefined;
    if (navState?.preview && Number(navState.preview.id) === id) {
      this.preview.set(navState.preview);
      return;
    }

    const cachedDoc = this.storage.getCachedDoc(id, type);
    if (cachedDoc?.payload) {
      const p = cachedDoc.payload as Record<string, unknown>;
      const rawPoster = (p['poster_path'] || p['posterUrl']) as string | undefined;
      const rawBackdrop = (p['backdrop_path'] || p['backdropUrl']) as string | undefined;
      const rawDate = String(p['release_date'] || p['first_air_date'] || '');
      this.preview.set({
        id,
        mediaType: type,
        title: String(p['title'] || p['name'] || ''),
        overview: String(p['overview'] || ''),
        posterUrl: rawPoster ? resolveMediaImageUrl(rawPoster, 'w500') : undefined,
        backdropUrl: rawBackdrop ? resolveMediaImageUrl(rawBackdrop, 'w1280') : undefined,
        releaseYear: rawDate.length >= 4 ? rawDate.slice(0, 4) : '',
        rating: p['vote_average'] ? Number(p['vote_average']).toFixed(1) : undefined
      });
    }
  }

  public async loadFullDetails(id: number, type: 'movie' | 'tv'): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.movieDetail.set(null);
    this.tvDetail.set(null);
    this.seasonDetailsMap.set({});
    this.castVideoGallery()?.closeVideo();

    try {
      if (type === 'movie') {
        const res = await firstValueFrom(
          this.moviesService.getMovieDetails(
            id,
            'credits,videos,watch/providers,release_dates,recommendations,similar,keywords,reviews,external_ids'
          )
        );
        this.movieDetail.set(res);
        this.syncDefaultWatchRegion();
      } else {
        const res = await firstValueFrom(
          this.tvService.getTvShowDetails(
            id,
            'aggregate_credits,credits,videos,watch/providers,content_ratings,recommendations,similar,keywords,reviews,external_ids'
          )
        );
        this.tvDetail.set(res);
        this.syncDefaultWatchRegion();

        const firstSeason =
          res.seasons?.find((s) => s.season_number === 1) ??
          res.seasons?.find((s) => s.season_number > 0) ??
          res.seasons?.[0];
        if (firstSeason) {
          await this.selectSeason(firstSeason.season_number);
        }
      }
      this.isLoading.set(false);
    } catch (err) {
      console.error('[MediaDetailPage] Failed to load details:', err);
      this.error.set('Could not load complete details. Showing available offline info.');
      this.isLoading.set(false);
    }
  }

  private syncDefaultWatchRegion(): void {
    const regions = this.availableWatchRegions();
    if (regions.length > 0 && !regions.includes(this.selectedWatchRegion())) {
      this.selectedWatchRegion.set(regions[0]);
    }
  }

  public async selectSeason(seasonNumber: number): Promise<void> {
    this.selectedSeasonNumber.set(seasonNumber);
    const existing = this.seasonDetailsMap()[seasonNumber];
    if (existing) return;

    const seriesId = this.tmdbId();
    if (!seriesId) return;

    this.isSeasonLoading.set(true);
    try {
      const seasonDetail = await firstValueFrom(
        this.tvSeasonsService.getTvSeasonDetails(seriesId, seasonNumber)
      );
      this.seasonDetailsMap.update((map) => ({
        ...map,
        [seasonNumber]: seasonDetail
      }));
    } catch (err) {
      console.warn(`[MediaDetailPage] Failed to load Season ${seasonNumber}:`, err);
    } finally {
      this.isSeasonLoading.set(false);
    }
  }

  // ==========================================
  // 🎯 USER ACTIONS (WATCHLIST, WATCHED, TRAILER, SHARE)
  // ==========================================

  private buildStoragePayload(): TmdbPayload {
    const m = this.movieDetail();
    if (m) {
      return {
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        backdrop_path: m.backdrop_path,
        release_date: m.release_date,
        vote_average: m.vote_average,
        genres: m.genres,
        media_type: 'movie'
      };
    }
    const t = this.tvDetail();
    if (t) {
      return {
        id: t.id,
        name: t.name,
        title: t.name,
        poster_path: t.poster_path,
        backdrop_path: t.backdrop_path,
        first_air_date: t.first_air_date,
        vote_average: t.vote_average,
        genres: t.genres,
        media_type: 'tv'
      };
    }
    const prev = this.preview();
    return {
      id: this.tmdbId(),
      title: prev?.title || '',
      name: prev?.title || '',
      posterUrl: prev?.posterUrl || '',
      media_type: this.mediaType()
    };
  }

  public async onToggleWatchlist(): Promise<void> {
    const id = this.tmdbId();
    const type = this.mediaType();
    const current = this.bookmarkState();
    const itemTitle = this.title();

    if (current === 'watchlist') {
      await this.storage.removeMedia(id, type);
      await this.toast.presentWarning(`Removed "${itemTitle}" from Watchlist`, 1800);
    } else {
      await this.storage.addToWatchlist(id, type, this.buildStoragePayload());
      await this.toast.presentSuccess(`Added "${itemTitle}" to Watchlist`, 1800);
    }
  }

  public async onToggleWatched(): Promise<void> {
    const id = this.tmdbId();
    const type = this.mediaType();
    const current = this.bookmarkState();
    const itemTitle = this.title();

    if (current === 'watched') {
      await this.storage.removeMedia(id, type);
      await this.toast.presentWarning(`Removed "${itemTitle}" from Watched`, 1800);
    } else {
      await this.storage.moveToWatched(id, type, this.buildStoragePayload());
      await this.toast.presentInfo(`Marked "${itemTitle}" as Watched`, 1800);
    }
  }

  public openOfficialTrailer(): void {
    const trailer = this.officialTrailer();
    if (trailer) {
      this.castVideoGallery()?.openVideo(trailer);
    }
  }

  public async shareMedia(): Promise<void> {
    const itemTitle = this.title();
    const year = this.releaseYearLabel();
    const rating = this.ratingValue();
    const typeLabel = this.mediaType() === 'tv' ? 'TV Series' : 'Movie';
    const tmdbUrl = `https://www.themoviedb.org/${this.mediaType()}/${this.tmdbId()}`;
    const summary = `🎬 ${itemTitle}${year ? ` (${year})` : ''} • ${typeLabel}${rating ? ` • ★ ${rating}` : ''}\n${this.overview().slice(0, 160)}...`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${itemTitle} on CineScope`,
          text: summary,
          url: tmdbUrl
        });
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${summary}\n${tmdbUrl}`);
        await this.toast.presentSuccess('Copied recommendation link to clipboard!', 2000);
      }
    } catch {
      // User dismissed native share sheet
    }
  }

  public toggleOverview(): void {
    this.overviewExpanded.update((v) => !v);
  }

  public goBack(): void {
    this.navCtrl.back();
  }

  private formatCurrency(value: number): string {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    return `$${value.toLocaleString()}`;
  }

  private extractSwimlaneList(key: 'recommendations' | 'similar'): SwimlaneItem[] {
    const m = this.movieDetail();
    if (m) {
      const raw = m[key] as { results?: TmdbMovieListItemDto[] } | undefined;
      return (raw?.results || [])
        .filter((item) => item.poster_path)
        .slice(0, 16)
        .map((item) => ({
          id: item.id,
          mediaType: 'movie' as const,
          title: item.title,
          posterUrl: resolveMediaImageUrl(item.poster_path, 'w342'),
          payload: item as unknown as Record<string, unknown>
        }));
    }

    const t = this.tvDetail();
    if (t) {
      const raw = t[key] as { results?: TmdbTvListItemDto[] } | undefined;
      return (raw?.results || [])
        .filter((item) => item.poster_path)
        .slice(0, 16)
        .map((item) => ({
          id: item.id,
          mediaType: 'tv' as const,
          title: item.name,
          posterUrl: resolveMediaImageUrl(item.poster_path, 'w342'),
          payload: item as unknown as Record<string, unknown>
        }));
    }

    return [];
  }
}
