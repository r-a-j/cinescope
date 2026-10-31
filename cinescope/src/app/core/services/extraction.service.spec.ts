import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { TmdbMultiSearchResultDto, TmdbSearchService } from './tmdb-search.service';
import { StorageService } from './storage.service';
import { ExtractionService } from './extraction.service';

const movieCandidate = (id: number, releaseDate: string): TmdbMultiSearchResultDto & { media_type: 'movie' } => ({
  id,
  media_type: 'movie' as const,
  title: 'The Incident',
  original_title: 'The Incident',
  release_date: releaseDate,
  adult: false,
  backdrop_path: null,
  overview: '',
  poster_path: null,
  original_language: 'en',
  genre_ids: [],
  popularity: 1,
  video: false,
  vote_average: 0,
  vote_count: 0
});

describe('ExtractionService title matching', () => {
  let service: ExtractionService;
  let searchMulti: jasmine.Spy;
  let addToInbox: jasmine.Spy;

  beforeEach(() => {
    searchMulti = jasmine.createSpy('searchMulti').and.returnValue(of({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [movieCandidate(2015, '2015-01-01')]
    }));
    addToInbox = jasmine.createSpy('addToInbox').and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        ExtractionService,
        { provide: HttpClient, useValue: { post: jasmine.createSpy('post') } },
        { provide: TmdbSearchService, useValue: { searchMulti } },
        { provide: StorageService, useValue: { addToInbox } }
      ]
    });
    service = TestBed.inject(ExtractionService);
  });

  it('does not queue a same-title candidate from a different year', async () => {
    await service.resolveAndQueueTitles([
      { title: 'The Incident', year: 2014, mediaType: 'movie' }
    ]);

    const [tmdbId, mediaType, payload] = addToInbox.calls.mostRecent().args as [
      number,
      'movie' | 'tv',
      Record<string, unknown>
    ];
    expect(tmdbId).not.toBe(2015);
    expect(mediaType).toBe('movie');
    expect(payload['title']).toBe('The Incident');
    expect(payload['release_date']).toBe('2014-01-01');
  });

  it('prefers the exact year when same-title candidates from adjacent years are returned', async () => {
    searchMulti.and.returnValue(of({
      page: 1,
      total_pages: 1,
      total_results: 2,
      results: [
        movieCandidate(2015, '2015-01-01'),
        movieCandidate(2014, '2014-01-01')
      ]
    }));

    await service.resolveAndQueueTitles([
      { title: 'The Incident', year: 2014, mediaType: 'movie' }
    ]);

    const [tmdbId, , payload] = addToInbox.calls.mostRecent().args as [
      number,
      'movie' | 'tv',
      Record<string, unknown>
    ];
    expect(tmdbId).toBe(2014);
    expect(payload['release_date']).toBe('2014-01-01');
  });
});
