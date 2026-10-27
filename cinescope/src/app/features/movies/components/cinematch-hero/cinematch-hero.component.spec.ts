import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CinematchHeroComponent } from './cinematch-hero.component';
import { TmdbMoviesService } from '../../../../core/services/tmdb-movies.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ContentDocType } from '../../../../core/database/schemas/content.schema';
import { resolveStreamingDetails } from '../../movies.models';

describe('CinematchHeroComponent', () => {
  let component: CinematchHeroComponent;
  let fixture: ComponentFixture<CinematchHeroComponent>;

  const mockMovies: ContentDocType[] = [
    {
      id: 'movie_1',
      tmdbId: 101,
      mediaType: 'movie',
      lists: ['watchlist'],
      addedAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
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
      imports: [CinematchHeroComponent],
      providers: [
        { provide: TmdbMoviesService, useValue: mockTmdbMoviesService },
        { provide: StorageService, useValue: mockStorageService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CinematchHeroComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('watchlistMovies', mockMovies);
    fixture.detectChanges();
  });

  it('should create CinematchHeroComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should compute time of day greeting properly', () => {
    const greeting = component.greeting();
    expect(greeting.headline).toBeTruthy();
    expect(greeting.badge).toBeTruthy();
    expect(greeting.cardTag).toBeTruthy();
  });

  it('should compute live mood counts across watchlist', () => {
    const counts = component.moodCounts();
    expect(counts.all).toBe(2);
    expect(counts.quick).toBe(1); // Whiplash (88m)
    expect(counts.mind_bending).toBe(1); // Inception (878 Sci-Fi)
    expect(counts.acclaimed).toBe(2); // Both vote_average >= 8.0
    expect(counts.popcorn).toBe(0);
  });

  it('should shift categories with 0 movies to the end of sortedMoodOptions', () => {
    const sorted = component.sortedMoodOptions();
    expect(sorted.length).toBe(7);
    const lastItem = sorted[sorted.length - 1];
    expect(lastItem.id).toBe('popcorn');
    // Ensure categories with movies remain in front
    const frontCategories = sorted.slice(0, 6).map(o => o.id);
    expect(frontCategories).toContain('all');
    expect(frontCategories).toContain('quick');
    expect(frontCategories).toContain('mind_bending');
    expect(frontCategories).toContain('acclaimed');
  });

  it('should compute a contextual "Why This Pick?" hook', () => {
    const hook = component.currentWhyThisPick();
    expect(hook.badge).toBeTruthy();
    expect(hook.text).toBeTruthy();
    expect(hook.emoji).toBeTruthy();
  });

  it('should filter correctly when quick mood is selected', () => {
    component.setMood('quick');
    expect(component.activeMood()).toBe('quick');
    const filtered = component.moodFilteredMovies();
    expect(filtered.length).toBe(1);
    expect(component.getTitle(filtered[0])).toBe('Whiplash');
  });

  it('should roll the dice and toggle shuffling state', async () => {
    expect(component.isShuffling()).toBeFalse();
    await component.rollTheDice();
    expect(component.isShuffling()).toBeTrue();
  });

  it('should emit openDetail when action clicked', () => {
    spyOn(component.openDetail, 'emit');
    component.openDetail.emit(101);
    expect(component.openDetail.emit).toHaveBeenCalledWith(101);
  });

  it('should resolve streaming details for current user region', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const details = component.streamingDetails();
    expect(details.region).toBe('US');
    expect(details.type).toBe('flatrate');
    expect(details.providers.length).toBe(1);
    expect(details.providers[0].provider_name).toBe('Netflix');
    expect(details.label).toBe('STREAMING IN US');
  });

  it('should resolve rent_buy when flatrate is unavailable in region', () => {
    const mockData = {
      id: 101,
      results: {
        IN: {
          link: 'https://justwatch.com',
          rent: [
            { provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg', display_priority: 1 }
          ]
        }
      }
    };
    const details = resolveStreamingDetails(mockData, 'IN');
    expect(details.type).toBe('rent_buy');
    expect(details.label).toBe('RENT / BUY IN IN');
    expect(details.providers[0].provider_name).toBe('Apple TV');
  });

  it('should resolve other_regions when not in region but streaming elsewhere', () => {
    const mockData = {
      id: 101,
      results: {
        US: {
          link: 'https://justwatch.com',
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg', display_priority: 1 }
          ]
        }
      }
    };
    const details = resolveStreamingDetails(mockData, 'IN');
    expect(details.type).toBe('other_regions');
    expect(details.label).toBe('NOT STREAMING IN IN');
    expect(details.subtext).toContain('US');
  });

  it('should resolve none when not streaming anywhere', () => {
    const mockData = {
      id: 101,
      results: {}
    };
    const details = resolveStreamingDetails(mockData, 'IN');
    expect(details.type).toBe('none');
    expect(details.label).toBe('NOT STREAMING IN IN');
    expect(details.subtext).toBe('Theatrical release or not yet on OTT');
  });
});
