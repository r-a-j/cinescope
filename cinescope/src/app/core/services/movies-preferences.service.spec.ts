import { TestBed } from '@angular/core/testing';
import { MoviesPreferencesService } from './movies-preferences.service';
import { ToastService } from './toast.service';

describe('MoviesPreferencesService', () => {
  let service: MoviesPreferencesService;

  const mockToastService = {
    presentSuccess: jasmine.createSpy('presentSuccess').and.returnValue(Promise.resolve()),
    presentInfo: jasmine.createSpy('presentInfo').and.returnValue(Promise.resolve()),
    presentWarning: jasmine.createSpy('presentWarning').and.returnValue(Promise.resolve()),
    presentError: jasmine.createSpy('presentError').and.returnValue(Promise.resolve())
  };

  beforeEach(() => {
    localStorage.removeItem('cinescope_movies_visibility');
    TestBed.configureTestingModule({
      providers: [
        MoviesPreferencesService,
        { provide: ToastService, useValue: mockToastService }
      ]
    });
    service = TestBed.inject(MoviesPreferencesService);
  });

  afterEach(() => {
    localStorage.removeItem('cinescope_movies_visibility');
  });

  it('should initialize with all sections visible by default', () => {
    const v = service.visibility();
    expect(v.cineMatch).toBeTrue();
    expect(v.franchises).toBeTrue();
    expect(v.blindTicket).toBeTrue();
    expect(v.graveyard).toBeTrue();
    expect(v.swimlanes).toBeTrue();
  });

  it('should toggle an individual section off and on', () => {
    service.toggleSection('cineMatch');
    expect(service.visibility().cineMatch).toBeFalse();

    service.toggleSection('cineMatch');
    expect(service.visibility().cineMatch).toBeTrue();
  });

  it('should reset all sections to true and show a success toast', async () => {
    service.toggleSection('blindTicket');
    service.toggleSection('graveyard');
    expect(service.visibility().blindTicket).toBeFalse();
    expect(service.visibility().graveyard).toBeFalse();

    await service.resetToDefault();
    expect(service.visibility().blindTicket).toBeTrue();
    expect(service.visibility().graveyard).toBeTrue();
    expect(mockToastService.presentSuccess).toHaveBeenCalled();
  });
});
