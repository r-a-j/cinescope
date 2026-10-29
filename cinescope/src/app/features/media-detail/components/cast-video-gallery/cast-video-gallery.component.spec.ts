import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';

import { CastVideoGalleryComponent, buildVideoTypeGroups } from './cast-video-gallery.component';
import { TmdbVideoDto } from '../../../../core/dtos/common/video.dto';

function video(id: string, type: string): TmdbVideoDto {
  return {
    id,
    key: `key_${id}`,
    name: `${type} ${id}`,
    site: 'YouTube',
    size: 1080,
    type,
    official: true,
    published_at: '2024-01-01T00:00:00.000Z',
    iso_639_1: 'en',
    iso_3166_1: 'US'
  };
}

describe('buildVideoTypeGroups', () => {
  it('returns no groups when every video has the same type', () => {
    expect(buildVideoTypeGroups([video('1', 'Trailer'), video('2', 'Trailer')])).toEqual([]);
  });

  it('orders known types by relevance and keeps unknown types at the end', () => {
    const groups = buildVideoTypeGroups([
      video('1', 'Featurette'),
      video('2', 'Mystery Type'),
      video('3', 'Trailer'),
      video('4', 'Behind the Scenes'),
      video('5', 'Trailer')
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      'All',
      'Trailers',
      'Featurettes',
      'Behind the Scenes',
      'Mystery Type'
    ]);
    expect(groups[0].count).toBe(5);
    expect(groups[1].count).toBe(2);
  });
});

describe('CastVideoGalleryComponent', () => {
  let fixture: ComponentFixture<CastVideoGalleryComponent>;
  let component: CastVideoGalleryComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CastVideoGalleryComponent],
      providers: [
        provideRouter([]),
        {
          provide: Platform,
          useValue: {
            backButton: {
              subscribeWithPriority: (): { unsubscribe: () => void } => ({ unsubscribe: (): void => undefined })
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CastVideoGalleryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('castList', []);
    fixture.componentRef.setInput('videos', [
      video('1', 'Trailer'),
      video('2', 'Teaser'),
      video('3', 'Behind the Scenes'),
      video('4', 'Trailer')
    ]);
    fixture.detectChanges();
  });

  it('filters videos by the selected type', () => {
    expect(component.filteredVideos().length).toBe(4);
    component.selectVideoType('Trailer');
    expect(component.filteredVideos().map((v) => v.id)).toEqual(['1', '4']);
  });

  it('falls back to all videos when the selected type disappears', () => {
    component.selectVideoType('Behind the Scenes');
    fixture.componentRef.setInput('videos', [video('9', 'Trailer'), video('10', 'Clip')]);
    expect(component.effectiveVideoType()).toBe('all');
    expect(component.filteredVideos().length).toBe(2);
  });

  it('renders filter chips only when more than one type exists', () => {
    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll('.video-type-chip');
    expect(chips.length).toBe(4); // All, Trailers, Teasers, Behind the Scenes

    fixture.componentRef.setInput('videos', [video('1', 'Trailer')]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.video-type-chip').length).toBe(0);
  });
});
