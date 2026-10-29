import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActionSheetController, Platform } from '@ionic/angular/standalone';
import { Subject } from 'rxjs';

import {
  MediaArtworkGalleryComponent,
  buildArtworkFilterOptions,
  mapTmdbImageToArtworkItem,
  sortAndDedupeTmdbImages
} from './media-artwork-gallery.component';
import { TmdbImageDto } from '../../../../core/dtos/common/image.dto';
import { ToastService } from '../../../../core/services/toast.service';

function img(partial: Partial<TmdbImageDto> & { file_path: string }): TmdbImageDto {
  return {
    aspect_ratio: 1.778,
    height: 1080,
    width: 1920,
    iso_639_1: null,
    vote_average: 5,
    vote_count: 1,
    ...partial
  };
}

describe('MediaArtworkGallery helpers', () => {
  it('maps a textless 4K backdrop to a clean wallpaper item', () => {
    const item = mapTmdbImageToArtworkItem(img({ file_path: '/a.jpg', width: 3840, height: 2160 }), 'backdrops');
    expect(item.variant).toBe('textless');
    expect(item.languageCode).toBeNull();
    expect(item.languageTag).toBe('TEXTLESS');
    expect(item.qualityTag).toBe('4K UHD');
    expect(item.resolutionLabel).toBe('3840 × 2160');
    expect(item.originalUrl).toContain('/original/a.jpg');
  });

  it('maps a language-tagged poster to a titled item with language display name', () => {
    const item = mapTmdbImageToArtworkItem(
      img({ file_path: '/p.jpg', iso_639_1: 'en', width: 2000, height: 3000 }),
      'posters'
    );
    expect(item.variant).toBe('titled');
    expect(item.languageCode).toBe('en');
    expect(item.languageName).toBe('English');
    expect(item.languageTag).toBe('EN');
    expect(item.qualityTag).toBe('UHD');
  });

  it('dedupes by file path and ranks by community score', () => {
    const sorted = sortAndDedupeTmdbImages([
      img({ file_path: '/low.jpg', vote_average: 2, vote_count: 3 }),
      img({ file_path: '/high.jpg', vote_average: 8, vote_count: 40 }),
      img({ file_path: '/high.jpg', vote_average: 8, vote_count: 40 })
    ]);
    expect(sorted.map((i) => i.file_path)).toEqual(['/high.jpg', '/low.jpg']);
  });

  it('builds language options when multiple languages or textless images exist', () => {
    const textlessOnly = [img({ file_path: '/a.jpg' }), img({ file_path: '/b.jpg' })].map((i) =>
      mapTmdbImageToArtworkItem(i, 'backdrops')
    );
    expect(buildArtworkFilterOptions(textlessOnly, 'backdrops')).toEqual([]);

    const mixed = [
      img({ file_path: '/a.jpg' }),
      img({ file_path: '/b.jpg', iso_639_1: 'en' }),
      img({ file_path: '/c.jpg', iso_639_1: 'zh' })
    ].map((i) => mapTmdbImageToArtworkItem(i, 'backdrops'));

    const options = buildArtworkFilterOptions(mixed, 'backdrops');
    expect(options.map((o) => o.id)).toEqual(['all', 'none', 'en', 'zh']);
    expect(options.map((o) => o.label)).toEqual(['All', 'Textless Wallpapers', 'English', 'Chinese']);
  });
});

describe('MediaArtworkGalleryComponent', () => {
  let fixture: ComponentFixture<MediaArtworkGalleryComponent>;
  let component: MediaArtworkGalleryComponent;

  const backButton$ = new Subject<void>();
  const mockPlatform = {
    is: (): boolean => false,
    backButton: {
      subscribeWithPriority: (): { unsubscribe: () => void } => {
        const sub = backButton$.subscribe();
        return { unsubscribe: (): void => sub.unsubscribe() };
      }
    }
  };

  const backdrops = [
    img({ file_path: '/clean1.jpg', vote_average: 9, vote_count: 50 }),
    img({ file_path: '/titled1.jpg', iso_639_1: 'en', vote_average: 7, vote_count: 20 }),
    img({ file_path: '/clean2.jpg', vote_average: 6, vote_count: 10 })
  ];
  const posters = [
    img({ file_path: '/poster-top.jpg', iso_639_1: 'en', aspect_ratio: 0.667, vote_average: 9, vote_count: 60 }),
    img({ file_path: '/poster-primary.jpg', iso_639_1: 'en', aspect_ratio: 0.667, vote_average: 5, vote_count: 2 })
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaArtworkGalleryComponent],
      providers: [
        { provide: Platform, useValue: mockPlatform },
        { provide: ActionSheetController, useValue: { create: jasmine.createSpy('create') } },
        {
          provide: ToastService,
          useValue: {
            presentSuccess: jasmine.createSpy('presentSuccess'),
            presentInfo: jasmine.createSpy('presentInfo'),
            presentWarning: jasmine.createSpy('presentWarning')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MediaArtworkGalleryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mediaTitle', 'Dune');
    fixture.componentRef.setInput('backdrops', backdrops);
    fixture.componentRef.setInput('posters', posters);
    fixture.detectChanges();
  });

  it('shows all backdrops by default and filters by language/textless option', () => {
    expect(component.activeCategory()).toBe('backdrops');
    expect(component.activeItems().length).toBe(3);

    component.selectFilter('none');
    expect(component.activeItems().map((i) => i.filePath)).toEqual(['/clean1.jpg', '/clean2.jpg']);

    component.selectFilter('en');
    expect(component.activeItems().map((i) => i.filePath)).toEqual(['/titled1.jpg']);
  });

  it('resets the filter when switching categories', () => {
    component.selectFilter('none');
    component.selectCategory('posters');
    expect(component.selectedFilterId()).toBe('all');
  });

  it('opens the hero poster by file path rather than the top-ranked poster', () => {
    component.openByFilePath('/poster-primary.jpg', 'posters');
    expect(component.activeCategory()).toBe('posters');
    expect(component.lightboxItem()?.filePath).toBe('/poster-primary.jpg');
  });

  it('wraps around when stepping through the lightbox and closes cleanly', () => {
    component.openLightbox(0);
    component.stepLightbox(-1);
    expect(component.lightboxIndex()).toBe(2);
    component.stepLightbox(1);
    expect(component.lightboxIndex()).toBe(0);

    component.closeLightbox();
    expect(component.lightboxItem()).toBeNull();
  });

  it('keeps the lightbox index valid when filtering while open', () => {
    component.openLightbox(2);
    component.selectFilter('en');
    expect(component.lightboxIndex()).toBe(0);
    expect(component.lightboxItem()?.filePath).toBe('/titled1.jpg');
  });
});
