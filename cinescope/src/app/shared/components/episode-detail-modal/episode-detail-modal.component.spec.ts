import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EpisodeDetailModalComponent } from './episode-detail-modal.component';
import { TmdbTvEpisodesService } from '../../../core/services/tmdb-tv-episodes.service';
import { TvProgressService } from '../../../core/services/tv-progress.service';
import { ToastService } from '../../../core/services/toast.service';
import { PosterCacheService } from '../../../core/services/poster-cache.service';
import { TmdbTvEpisodeDetailDto } from '../../../core/dtos/tv-episodes/tv-episode-detail.dto';
import { TmdbTvSeasonCrewDto } from '../../../core/dtos/tv-seasons/tv-season-detail.dto';

describe('EpisodeDetailModalComponent', () => {
  let component: EpisodeDetailModalComponent;
  let componentRef: ComponentRef<EpisodeDetailModalComponent>;
  let fixture: ComponentFixture<EpisodeDetailModalComponent>;
  let router: Router;

  let mockEpisodesService: { getTvEpisodeDetails: jasmine.Spy };
  let mockTvProgress: {
    isEpisodeWatched: jasmine.Spy;
    toggleEpisode: jasmine.Spy;
  };
  let mockToast: {
    presentSuccess: jasmine.Spy;
    presentWarning: jasmine.Spy;
  };
  let mockPosterCache: { prewarmUrls: jasmine.Spy };

  const sampleEpisodeDetail: Partial<TmdbTvEpisodeDetailDto> = {
    id: 101,
    name: 'The Defeated',
    overview: 'Mark and the team execute a daring plan.',
    still_path: '/still_s1e4.jpg',
    air_date: '2024-10-28',
    runtime: 54,
    vote_average: 8.8,
    vote_count: 1240,
    episode_number: 4,
    season_number: 1,
    episode_type: 'finale',
    crew: [
      { id: 1, name: 'Ben Stiller', job: 'Director', department: 'Directing', profile_path: null, credit_id: 'c1' } as unknown as TmdbTvSeasonCrewDto,
      { id: 2, name: 'Dan Erickson', job: 'Writer', department: 'Writing', profile_path: null, credit_id: 'c2' } as unknown as TmdbTvSeasonCrewDto
    ],
    guest_stars: [
      { id: 3, name: 'Christopher Walken', character: 'Burt', profile_path: '/walken.jpg', order: 1, credit_id: 'c3', adult: false, gender: 2, known_for_department: 'Acting', original_name: 'Christopher Walken', popularity: 12.5 }
    ],
    videos: {
      id: 101,
      results: [
        {
          id: 'v1',
          key: 'abc12345',
          name: 'Next Week On Episode 4',
          site: 'YouTube',
          type: 'Promo',
          official: true,
          published_at: '2024-10-21',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          size: 1080
        }
      ]
    },
    external_ids: {
      id: 101,
      imdb_id: 'tt9999999',
      freebase_id: null,
      freebase_mid: null,
      tvdb_id: null,
      tvrage_id: null,
      wikidata_id: null
    }
  };

  beforeEach(async () => {
    mockEpisodesService = {
      getTvEpisodeDetails: jasmine.createSpy('getTvEpisodeDetails').and.returnValue(of(sampleEpisodeDetail))
    };

    mockTvProgress = {
      isEpisodeWatched: jasmine.createSpy('isEpisodeWatched').and.returnValue(false),
      toggleEpisode: jasmine.createSpy('toggleEpisode').and.returnValue(Promise.resolve(true))
    };

    mockToast = {
      presentSuccess: jasmine.createSpy('presentSuccess').and.returnValue(Promise.resolve()),
      presentWarning: jasmine.createSpy('presentWarning').and.returnValue(Promise.resolve())
    };

    mockPosterCache = {
      prewarmUrls: jasmine.createSpy('prewarmUrls')
    };

    await TestBed.configureTestingModule({
      imports: [EpisodeDetailModalComponent],
      providers: [
        provideRouter([]),
        { provide: TmdbTvEpisodesService, useValue: mockEpisodesService },
        { provide: TvProgressService, useValue: mockTvProgress },
        { provide: ToastService, useValue: mockToast },
        { provide: PosterCacheService, useValue: mockPosterCache }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EpisodeDetailModalComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('ion-modal').forEach((m) => m.remove());
    document.body.style.overflow = '';
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur?.();
    }
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should load episode details when modal opens with valid seriesId', fakeAsync(() => {
    componentRef.setInput('isOpen', true);
    componentRef.setInput('seriesId', 95396);
    componentRef.setInput('seasonNumber', 1);
    componentRef.setInput('episodeNumber', 4);
    componentRef.setInput('seriesTitle', 'Severance');
    fixture.detectChanges();
    tick();

    expect(mockEpisodesService.getTvEpisodeDetails).toHaveBeenCalledWith(
      95396,
      1,
      4,
      'credits,videos,external_ids,images'
    );
    expect(component.detail()?.name).toBe('The Defeated');
    expect(component.episodeCode()).toBe('S1 • E4');
    expect(component.formattedAirDate()).toContain('2024');
    expect(component.formattedRuntime()).toBe('54 min');
    expect(component.ratingFormatted()).toBe('8.8');
    expect(component.episodeTypeLabel()).toBe('Season Finale');
    expect(component.isFinale()).toBeTrue();
    expect(component.directors().length).toBe(1);
    expect(component.directors()[0].name).toBe('Ben Stiller');
    expect(component.guestStars().length).toBe(1);
    expect(component.promoVideos().length).toBe(1);
    expect(component.imdbUrl()).toBe('https://www.imdb.com/title/tt9999999/');
    expect(mockPosterCache.prewarmUrls).toHaveBeenCalled();
  }));

  it('should toggle watched status and show success toast', async () => {
    componentRef.setInput('seriesId', 95396);
    component.currentSeasonNumber.set(1);
    component.currentEpisodeNumber.set(4);

    let emitted: { seasonNumber: number; episodeNumber: number; isWatched: boolean } | null = null;
    component.watchedToggle.subscribe((val) => {
      emitted = val;
    });

    await component.toggleWatched();

    expect(mockTvProgress.toggleEpisode).toHaveBeenCalledWith(
      95396,
      1,
      4,
      jasmine.any(Object)
    );
    expect(emitted).toEqual(jasmine.objectContaining({ seasonNumber: 1, episodeNumber: 4, isWatched: true }));
    expect(mockToast.presentSuccess).toHaveBeenCalled();
  });

  it('should step forward and backward through episodes', fakeAsync(() => {
    componentRef.setInput('isOpen', true);
    componentRef.setInput('seriesId', 95396);
    componentRef.setInput('seasonNumber', 1);
    componentRef.setInput('episodeNumber', 4);
    componentRef.setInput('totalEpisodesInSeason', 10);
    fixture.detectChanges();
    tick();

    expect(component.canGoPrev()).toBeTrue();
    expect(component.canGoNext()).toBeTrue();

    // Next Episode
    component.goToNextEpisode();
    tick();
    expect(component.currentEpisodeNumber()).toBe(5);

    // Prev Episode
    component.goToPrevEpisode();
    tick();
    expect(component.currentEpisodeNumber()).toBe(4);
  }));

  it('should close modal and navigate to full series page', () => {
    spyOn(router, 'navigate');
    let dismissed = false;
    component.didDismiss.subscribe(() => {
      dismissed = true;
    });

    componentRef.setInput('seriesId', 95396);
    component.openFullSeriesPage();

    expect(dismissed).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/media', 'tv', 95396]);
  });

  it('should handle API errors gracefully', fakeAsync(() => {
    mockEpisodesService.getTvEpisodeDetails.and.returnValue(
      throwError(() => new Error('TMDB Network failure'))
    );

    component.loadEpisode(95396, 1, 99);
    tick();

    expect(component.error()).toBe('Episode details could not be loaded at this time.');
    expect(component.isLoading()).toBeFalse();
  }));
});
