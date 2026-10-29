import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BlindTicketComponent } from './blind-ticket.component';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import { TmdbMoviesService } from '../../../../core/services/tmdb-movies.service';
import { StorageService } from '../../../../core/services/storage.service';
import { TimeContextService } from '../../../../core/services/time-context.service';

describe('BlindTicketComponent', () => {
  let component: BlindTicketComponent;
  let fixture: ComponentFixture<BlindTicketComponent>;
  let timeContextService: TimeContextService;

  const mockMovies: ContentDocType[] = [
    {
      id: 'movie_1',
      tmdbId: 101,
      mediaType: 'movie',
      lists: ['watchlist'],
      addedAt: new Date().toISOString(),
      payload: {
        id: 101,
        title: 'Inception',
        vote_average: 8.8,
        overview: 'A dream-heist movie.',
        genre_ids: [28, 878]
      }
    }
  ];

  const mockTmdbMoviesService = {
    getMovieWatchProviders: jasmine.createSpy('getMovieWatchProviders').and.returnValue(of({
      id: 101,
      results: {
        US: {
          link: 'https://justwatch.com',
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', display_priority: 1 }
          ]
        }
      }
    }))
  };

  const mockStorageService = {
    userRegion: jasmine.createSpy('userRegion').and.returnValue('US')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlindTicketComponent],
      providers: [
        { provide: TmdbMoviesService, useValue: mockTmdbMoviesService },
        { provide: StorageService, useValue: mockStorageService }
      ]
    }).compileComponents();

    timeContextService = TestBed.inject(TimeContextService);
    fixture = TestBed.createComponent(BlindTicketComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('watchlistMovies', mockMovies);
    fixture.detectChanges();
  });

  it('should create BlindTicketComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should start with ticket unrevealed', () => {
    expect(component.isBlindTicketRevealed()).toBeFalse();
    expect(component.blindTicketMovie()).toBeTruthy();
  });

  it('should reveal ticket on tear', async () => {
    await component.tearBlindTicket();
    expect(component.isBlindTicketRevealed()).toBeTrue();
  });

  it('should handle hold start and trigger tear after 500ms', () => {
    jasmine.clock().install();
    expect(component.isHolding()).toBeFalse();
    component.onHoldStart();
    expect(component.isHolding()).toBeTrue();

    jasmine.clock().tick(500);
    expect(component.isBlindTicketRevealed()).toBeTrue();
    expect(component.isHolding()).toBeFalse();
    jasmine.clock().uninstall();
  });

  it('should cancel hold if released before 500ms', () => {
    jasmine.clock().install();
    component.onHoldStart();
    expect(component.isHolding()).toBeTrue();

    jasmine.clock().tick(250);
    component.onHoldEnd();
    expect(component.isHolding()).toBeFalse();
    expect(component.isBlindTicketRevealed()).toBeFalse();

    jasmine.clock().tick(300);
    expect(component.isBlindTicketRevealed()).toBeFalse();
    jasmine.clock().uninstall();
  });

  it('should not reveal ticket on fast tap or early release', () => {
    jasmine.clock().install();
    component.onHoldStart();
    jasmine.clock().tick(100);
    component.onHoldEnd();

    expect(component.isHolding()).toBeFalse();
    expect(component.isBlindTicketRevealed()).toBeFalse();
    jasmine.clock().uninstall();
  });

  it('should handle hold via keyboard Enter/Space', () => {
    jasmine.clock().install();
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(component.isHolding()).toBeTrue();

    jasmine.clock().tick(500);
    expect(component.isBlindTicketRevealed()).toBeTrue();

    component.onKeyUp(new KeyboardEvent('keyup', { key: 'Enter' }));
    expect(component.isHolding()).toBeFalse();
    jasmine.clock().uninstall();
  });

  it('should load watch providers and resolve streaming details in user region', async () => {
    await fixture.whenStable();
    expect(mockTmdbMoviesService.getMovieWatchProviders).toHaveBeenCalledWith(101);
    const streaming = component.streamingDetails();
    expect(streaming.region).toBe('US');
    expect(streaming.type).toBe('flatrate');
    expect(streaming.providers.length).toBe(1);
    expect(streaming.providers[0].provider_name).toBe('Netflix');
  });

  it('should conceal identifying details when ticket is sealed and show them when revealed', async () => {
    timeContextService.refresh(new Date(2026, 9, 29, 8, 0, 0));
    await fixture.whenStable();
    fixture.detectChanges();

    // Sealed state
    expect(component.isBlindTicketRevealed()).toBeFalse();
    let text = fixture.nativeElement.textContent;
    expect(text).toContain("MYSTERY THIS MORNING'S FEATURED PICK");
    expect(text).toContain('SEALED');
    expect(text).not.toContain('ADMIT ONE');
    expect(text).not.toContain('Inception');
    expect(text).not.toContain('Action');
    expect(text).not.toContain('Sci-Fi');
    expect(fixture.nativeElement.querySelector('.streaming-details-row')).toBeNull();
    expect(fixture.nativeElement.querySelector('.admit-stamp')).toBeNull();

    // Tear ticket
    await component.tearBlindTicket();
    fixture.detectChanges();

    // Revealed state
    expect(component.isBlindTicketRevealed()).toBeTrue();
    text = fixture.nativeElement.textContent;
    expect(text).toContain("THIS MORNING'S FEATURED PICK");
    expect(text).not.toContain("MYSTERY THIS MORNING'S FEATURED PICK");
    expect(text).toContain('Inception');
    expect(text).toContain('Action');
    expect(text).toContain('Sci-Fi');
    expect(text).toContain('Details');
    expect(text).not.toContain('ADMIT ONE');
    expect(fixture.nativeElement.querySelector('.streaming-details-row')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.admit-stamp')).toBeNull();
  });

  it('should dynamically update ticket series tag according to TimeContextService and reveal state', () => {
    timeContextService.refresh(new Date(2026, 9, 29, 8, 0, 0));
    fixture.detectChanges();
    expect(component.ticketSeriesTag()).toBe("MYSTERY THIS MORNING'S FEATURED PICK");

    timeContextService.refresh(new Date(2026, 9, 29, 14, 0, 0));
    fixture.detectChanges();
    expect(component.ticketSeriesTag()).toBe('MYSTERY AFTERNOON MATINEE PICK');

    component.tearBlindTicket();
    fixture.detectChanges();
    expect(component.ticketSeriesTag()).toBe('AFTERNOON MATINEE PICK');

    timeContextService.refresh(new Date(2026, 9, 29, 20, 0, 0));
    fixture.detectChanges();
    expect(component.ticketSeriesTag()).toBe("TONIGHT'S FEATURED PICK");

    timeContextService.refresh(new Date(2026, 9, 29, 23, 30, 0));
    fixture.detectChanges();
    expect(component.ticketSeriesTag()).toBe('MIDNIGHT SCREENING PICK');
  });

  it('should emit openDetail when Details button is clicked and markWatched when checkmark button is clicked', () => {
    const openDetailSpy = spyOn(component.openDetail, 'emit');
    const markWatchedSpy = spyOn(component.markWatched, 'emit');

    component.tearBlindTicket();
    fixture.detectChanges();

    const detailsBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-details');
    expect(detailsBtn).toBeTruthy();
    expect(detailsBtn.textContent).toContain('Details');
    detailsBtn.click();
    expect(openDetailSpy).toHaveBeenCalledWith(101);

    const markWatchedBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-mark-watched');
    expect(markWatchedBtn).toBeTruthy();
    markWatchedBtn.click();
    expect(markWatchedSpy).toHaveBeenCalledWith(mockMovies[0]);
  });

  it('should redact movie title in sealed overview', () => {
    const movieWithTitleInOverview: ContentDocType = {
      ...mockMovies[0],
      payload: {
        ...(mockMovies[0].payload as Record<string, unknown>),
        overview: 'In Inception, a team dives into dreams.'
      }
    };

    expect(component.isBlindTicketRevealed()).toBeFalse();
    const sealedOverview = component.getSealedOverview(movieWithTitleInOverview);
    expect(sealedOverview).toContain('In ██████, a team dives into dreams.');
    expect(sealedOverview).not.toContain('Inception');

    component.tearBlindTicket();
    const revealedOverview = component.getSealedOverview(movieWithTitleInOverview);
    expect(revealedOverview).toContain('In Inception, a team dives into dreams.');
  });
});
