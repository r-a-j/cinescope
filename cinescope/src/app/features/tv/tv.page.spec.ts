import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { TvPage } from './tv.page';
import { TvProgressService, AirRadarItem, WatchlistReadySeries } from '../../core/services/tv-progress.service';
import { StorageService } from '../../core/services/storage.service';
import { TmdbTvService } from '../../core/services/tmdb-tv.service';
import { ToastService } from '../../core/services/toast.service';
import { MediaMetadataService } from '../../core/services/media-metadata.service';
import { TvProgressDocType } from '../../core/database/schemas/tv-progress.schema';
import { ContentDocType } from '../../core/database/schemas/content.schema';
import { of } from 'rxjs';

describe('TvPage', () => {
  let component: TvPage;
  let fixture: ComponentFixture<TvPage>;
  let router: Router;

  const mockAllProgress = signal<TvProgressDocType[]>([]);
  const mockWatchlistReady = signal<WatchlistReadySeries[]>([]);
  const mockAirRadar = signal<AirRadarItem[]>([]);
  const mockCurrentlyWatching = signal<TvProgressDocType[]>([]);
  const mockCompletedSeries = signal<TvProgressDocType[]>([]);

  const mockWatchedItems = signal<ContentDocType[]>([]);

  const mockTvProgressService = {
    allProgress: mockAllProgress,
    watchlistReadyToStart: mockWatchlistReady,
    airRadar: mockAirRadar,
    currentlyWatching: mockCurrentlyWatching,
    completedSeries: mockCompletedSeries,
    markEpisodeWatched: jasmine.createSpy('markEpisodeWatched').and.returnValue(Promise.resolve()),
    getUpNextEpisode: jasmine.createSpy('getUpNextEpisode').and.returnValue({ seasonNumber: 1, episodeNumber: 1 })
  };

  const mockStorageService = {
    watchlistItems: signal([]),
    watchedItems: mockWatchedItems
  };

  const mockTmdbTvService = {
    getTvShowDetails: jasmine.createSpy('getTvShowDetails').and.returnValue(of(null))
  };

  const mockToastService = {
    presentSuccess: jasmine.createSpy('presentSuccess').and.returnValue(Promise.resolve())
  };

  const mockMediaMetadataService = {
    handleImageError: jasmine.createSpy('handleImageError'),
    healMediaMetadata: jasmine.createSpy('healMediaMetadata').and.returnValue(Promise.resolve()),
    queueBackgroundHealing: jasmine.createSpy('queueBackgroundHealing'),
    getEpisodeStillUrl: jasmine.createSpy('getEpisodeStillUrl').and.returnValue(Promise.resolve(null))
  };

  beforeEach(async () => {
    mockAllProgress.set([]);
    mockWatchlistReady.set([]);
    mockAirRadar.set([]);
    mockCurrentlyWatching.set([]);
    mockCompletedSeries.set([]);
    mockWatchedItems.set([]);

    await TestBed.configureTestingModule({
      imports: [TvPage],
      providers: [
        provideRouter([]),
        { provide: TvProgressService, useValue: mockTvProgressService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: TmdbTvService, useValue: mockTmdbTvService },
        { provide: ToastService, useValue: mockToastService },
        { provide: MediaMetadataService, useValue: mockMediaMetadataService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TvPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should render empty state when no TV content is tracked or watchlisted', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.tv-empty-container')).toBeTruthy();
    expect(compiled.querySelector('.tv-empty-title')?.textContent).toContain('TRACK TV SEASONS');
  });

  it('should navigate to Discover when clicking CTA in empty state', () => {
    spyOn(router, 'navigate');
    component.navigateToDiscover();
    expect(router.navigate).toHaveBeenCalledWith(['/tabs/discover']);
  });

  it('should display hero section and cards when TV series exist', () => {
    mockAllProgress.set([
      {
        id: 'tv_1396',
        tmdbId: 1396,
        seriesTitle: 'Breaking Bad',
        totalSeasons: 5,
        totalEpisodes: 62,
        watchedEpisodesCount: 15,
        lastWatchedSeason: 2,
        lastWatchedEpisode: 8,
        lastWatchedEpisodeTitle: 'Better Call Saul',
        watchedEpisodes: ['s1e1', 's2e8'],
        updatedAt: Date.now()
      }
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.tv-empty-container')).toBeNull();
    expect(compiled.querySelector('.tv-hero-stage')).toBeTruthy();
    expect(compiled.querySelector('.hero-title')?.textContent).toContain('Breaking Bad');
  });

  it('should filter series by Binge Sizer filter', () => {
    mockAllProgress.set([
      {
        id: 'tv_1',
        tmdbId: 1,
        seriesTitle: 'Short Limited Series',
        totalSeasons: 1,
        totalEpisodes: 6,
        watchedEpisodesCount: 2,
        watchedEpisodes: ['s1e1', 's1e2'],
        updatedAt: Date.now()
      },
      {
        id: 'tv_2',
        tmdbId: 2,
        seriesTitle: 'Long Epic Show',
        totalSeasons: 8,
        totalEpisodes: 73,
        watchedEpisodesCount: 30,
        watchedEpisodes: ['s1e1'],
        updatedAt: Date.now()
      }
    ]);

    fixture.detectChanges();

    expect(component.filteredCards().length).toBe(2);

    // Filter to quick bites (<= 10 eps)
    component.setFilter('quick');
    expect(component.filteredCards().length).toBe(1);
    expect(component.filteredCards()[0].title).toBe('Short Limited Series');

    // Filter to long hauls (> 24 eps or >= 3 seasons)
    component.setFilter('long');
    expect(component.filteredCards().length).toBe(1);
    expect(component.filteredCards()[0].title).toBe('Long Epic Show');
  });

  it('should call markEpisodeWatched and show toast when marking next episode', async () => {
    const card = {
      id: 1396,
      title: 'Breaking Bad',
      posterUrl: '',
      totalSeasons: 5,
      totalEpisodes: 62,
      watchedEpisodesCount: 10,
      percentage: 16,
      isCompleted: false,
      isUnstarted: false,
      upNextSeason: 2,
      upNextEpisode: 3
    };

    const mockEvent = new Event('click');
    await component.onMarkNextEpisodeWatched(mockEvent, card);

    expect(mockTvProgressService.markEpisodeWatched).toHaveBeenCalledWith(
      1396,
      2,
      3,
      jasmine.objectContaining({ title: 'Breaking Bad' })
    );
    expect(mockToastService.presentSuccess).toHaveBeenCalled();
  });

  it('should allow switching the hero series', () => {
    mockAllProgress.set([
      {
        id: 'tv_1',
        tmdbId: 1,
        seriesTitle: 'Show Alpha',
        totalSeasons: 2,
        totalEpisodes: 20,
        watchedEpisodesCount: 5,
        watchedEpisodes: ['s1e1'],
        updatedAt: Date.now()
      },
      {
        id: 'tv_2',
        tmdbId: 2,
        seriesTitle: 'Show Beta',
        totalSeasons: 3,
        totalEpisodes: 30,
        watchedEpisodesCount: 8,
        watchedEpisodes: ['s1e1'],
        updatedAt: Date.now()
      }
    ]);

    component.selectHero(2);
    expect(component.heroSeries()?.title).toBe('Show Beta');
  });

  it('should render Air Radar when upcoming episodes exist', () => {
    mockAllProgress.set([
      {
        id: 'tv_1',
        tmdbId: 1,
        seriesTitle: 'Show Alpha',
        totalSeasons: 2,
        totalEpisodes: 20,
        watchedEpisodesCount: 5,
        watchedEpisodes: ['s1e1'],
        updatedAt: Date.now()
      }
    ]);

    mockAirRadar.set([
      {
        tmdbId: 1,
        seriesTitle: 'Show Alpha',
        seasonNumber: 3,
        episodeNumber: 1,
        episodeTitle: 'Premiere',
        airDate: '2026-11-05',
        daysUntil: 6
      }
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.air-radar-section')).toBeTruthy();
    expect(compiled.querySelector('.radar-show-title')?.textContent).toContain('Show Alpha');
  });

  it('should include previously watched TV shows without progress doc as 100% completed cards', () => {
    mockWatchedItems.set([
      {
        id: 'tv_888',
        tmdbId: 888,
        mediaType: 'tv',
        lists: ['watched'],
        addedAt: '2026-10-30T10:00:00Z',
        payload: {
          name: 'Classic Complete Series',
          number_of_seasons: 3,
          number_of_episodes: 30
        }
      }
    ]);

    fixture.detectChanges();

    const cards = component.allDisplayCards();
    expect(cards.length).toBe(1);
    expect(cards[0].id).toBe(888);
    expect(cards[0].title).toBe('Classic Complete Series');
    expect(cards[0].percentage).toBe(100);
    expect(cards[0].isCompleted).toBeTrue();
    expect(cards[0].isUnstarted).toBeFalse();
  });

  it('should delegate image errors and backdrop errors to MediaMetadataService', () => {
    const fakeEvent = {
      target: document.createElement('img')
    } as unknown as Event;

    component.onImageError(fakeEvent, 95396);
    expect(mockMediaMetadataService.handleImageError).toHaveBeenCalledWith(fakeEvent, 95396, 'tv');

    component.onBackdropError(fakeEvent, 95396);
    expect((fakeEvent.target as HTMLImageElement).style.display).toBe('none');
    expect(mockMediaMetadataService.healMediaMetadata).toHaveBeenCalledWith(95396, 'tv');
  });

  it('should fall back from episode still to series backdrop when still fails to load', () => {
    mockAllProgress.set([
      {
        id: 'tv_101',
        tmdbId: 101,
        seriesTitle: 'Show Alpha',
        backdropPath: '/show_alpha_backdrop.jpg',
        posterPath: '/show_alpha_poster.jpg',
        totalSeasons: 2,
        totalEpisodes: 20,
        watchedEpisodesCount: 3,
        watchedEpisodes: ['s1e1', 's1e2', 's1e3'],
        lastWatchedSeason: 1,
        lastWatchedEpisode: 3,
        updatedAt: 1000
      }
    ]);

    fixture.detectChanges();

    // Set episode still
    component.heroEpisodeStillUrl.set('https://image.tmdb.org/t/p/w780/episode_still.jpg');
    expect(component.heroBackdropUrl()).toBe('https://image.tmdb.org/t/p/w780/episode_still.jpg');

    // Simulate img error on the episode still
    const fakeImg = document.createElement('img');
    fakeImg.src = 'https://image.tmdb.org/t/p/w780/episode_still.jpg';
    const fakeEvent = { target: fakeImg } as unknown as Event;

    component.onBackdropError(fakeEvent, 101);

    // Should switch image source to series backdrop
    expect(fakeImg.src).toContain('/show_alpha_backdrop.jpg');
    expect(component.heroBackdropUrl()).toContain('/show_alpha_backdrop.jpg');
  });
});
