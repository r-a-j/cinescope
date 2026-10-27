import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlindTicketComponent } from './blind-ticket.component';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';

describe('BlindTicketComponent', () => {
  let component: BlindTicketComponent;
  let fixture: ComponentFixture<BlindTicketComponent>;

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
        overview: 'A dream-heist movie.'
      }
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlindTicketComponent]
    }).compileComponents();

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
});
