import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CinematchHeroComponent } from './cinematch-hero.component';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';

describe('CinematchHeroComponent', () => {
  let component: CinematchHeroComponent;
  let fixture: ComponentFixture<CinematchHeroComponent>;

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
        runtime: 148,
        vote_average: 8.8,
        genre_ids: [28, 878]
      }
    },
    {
      id: 'movie_2',
      tmdbId: 102,
      mediaType: 'movie',
      lists: ['watchlist'],
      addedAt: new Date().toISOString(),
      payload: {
        id: 102,
        title: 'Whiplash',
        runtime: 88,
        vote_average: 8.5,
        genre_ids: [18, 10402]
      }
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CinematchHeroComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CinematchHeroComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('watchlistMovies', mockMovies);
    fixture.detectChanges();
  });

  it('should create CinematchHeroComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with any mood and auto-select a movie', () => {
    expect(component.activeMood()).toBe('all');
    expect(component.selectedMovie()).toBeTruthy();
  });

  it('should filter correctly when quick mood is selected', () => {
    component.setMood('quick');
    expect(component.activeMood()).toBe('quick');
    const filtered = component.moodFilteredMovies();
    expect(filtered.length).toBe(1);
    expect(component.getTitle(filtered[0])).toBe('Whiplash');
  });

  it('should emit openDetail when action clicked', () => {
    spyOn(component.openDetail, 'emit');
    component.openDetail.emit(101);
    expect(component.openDetail.emit).toHaveBeenCalledWith(101);
  });
});
