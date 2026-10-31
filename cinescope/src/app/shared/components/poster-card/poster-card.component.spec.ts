import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { PosterCardComponent } from './poster-card.component';
import { PosterCacheService } from '../../../core/services/poster-cache.service';
import { MediaMetadataService } from '../../../core/services/media-metadata.service';
import { DEFAULT_POSTER_PLACEHOLDER } from '../../../core/constants/api.constants';

describe('PosterCardComponent', () => {
  let component: PosterCardComponent;
  let componentRef: ComponentRef<PosterCardComponent>;
  let fixture: ComponentFixture<PosterCardComponent>;

  let mockPosterCache: {
    resolveFallbackUrl: jasmine.Spy;
    isWarm: jasmine.Spy;
    markLoaded: jasmine.Spy;
  };
  let mockMediaMetadata: {
    healMediaMetadata: jasmine.Spy;
  };

  beforeEach(async () => {
    mockPosterCache = {
      resolveFallbackUrl: jasmine.createSpy('resolveFallbackUrl').and.callFake((url: string) => url || DEFAULT_POSTER_PLACEHOLDER),
      isWarm: jasmine.createSpy('isWarm').and.returnValue(false),
      markLoaded: jasmine.createSpy('markLoaded')
    };

    mockMediaMetadata = {
      healMediaMetadata: jasmine.createSpy('healMediaMetadata').and.returnValue(Promise.resolve(true))
    };

    await TestBed.configureTestingModule({
      imports: [PosterCardComponent],
      providers: [
        { provide: PosterCacheService, useValue: mockPosterCache },
        { provide: MediaMetadataService, useValue: mockMediaMetadata }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PosterCardComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should emit cardClick when onCardClick is called', () => {
    let clicked = false;
    component.cardClick.subscribe(() => {
      clicked = true;
    });

    component.onCardClick();
    expect(clicked).toBeTrue();
  });

  it('should emit bookmarkToggle and stopPropagation on bookmark click', () => {
    let toggled = false;
    component.bookmarkToggle.subscribe(() => {
      toggled = true;
    });

    const fakeEvent = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);
    component.onBookmarkClick(fakeEvent);

    expect(fakeEvent.stopPropagation).toHaveBeenCalled();
    expect(toggled).toBeTrue();
  });

  it('should handle image error by setting placeholder and dispatching healing', () => {
    componentRef.setInput('tmdbId', 95396);
    componentRef.setInput('mediaType', 'tv');
    componentRef.setInput('imageUrl', 'https://image.tmdb.org/t/p/w342/severance_broken.jpg');
    fixture.detectChanges();

    const fakeImg = document.createElement('img');
    fakeImg.src = 'https://image.tmdb.org/t/p/w342/severance_broken.jpg';

    const fakeEvent = {
      target: fakeImg
    } as unknown as Event;

    component.handleImageError(fakeEvent);

    expect(fakeImg.src).toContain(DEFAULT_POSTER_PLACEHOLDER);
    expect(mockMediaMetadata.healMediaMetadata).toHaveBeenCalledWith(95396, 'tv');
  });

  it('should mark cache loaded when image finishes loading with dimensions', () => {
    componentRef.setInput('imageUrl', 'https://image.tmdb.org/t/p/w342/valid.jpg');
    fixture.detectChanges();

    const fakeImg = {
      complete: true,
      naturalWidth: 300
    } as unknown as HTMLImageElement;

    const fakeEvent = {
      target: fakeImg
    } as unknown as Event;

    component.handleImageLoad(fakeEvent);

    expect(mockPosterCache.markLoaded).toHaveBeenCalledWith(
      'https://image.tmdb.org/t/p/w342/valid.jpg',
      fakeImg
    );
  });
});
