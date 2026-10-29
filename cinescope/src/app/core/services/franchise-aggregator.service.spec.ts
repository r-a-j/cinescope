import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FranchiseAggregatorService } from './franchise-aggregator.service';
import { StorageService } from './storage.service';
import { TmdbCollectionsService } from './tmdb-collections.service';
import { TmdbMoviesService } from './tmdb-movies.service';

describe('FranchiseAggregatorService', () => {
  let service: FranchiseAggregatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FranchiseAggregatorService,
        {
          provide: StorageService,
          useValue: {
            watchlistItems: signal([]),
            watchedItems: signal([])
          }
        },
        { provide: TmdbCollectionsService, useValue: {} },
        { provide: TmdbMoviesService, useValue: {} }
      ]
    });
    service = TestBed.inject(FranchiseAggregatorService);
  });

  it('does not round an unfinished franchise up to 100% completion', () => {
    const parts = Array.from({ length: 200 }, (_, index) => ({
      id: index + 1,
      title: `Part ${index + 1}`,
      release_date: '2020-01-01'
    }));
    const watched = new Set(parts.slice(0, 199).map(part => `movie_${part.id}`));

    const progress = service.computePartsProgress(parts, watched, new Set());

    expect(progress.completionPercentage).toBe(99);
    expect(progress.upNextPart?.id).toBe(200);
  });
});
