import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, pipe, switchMap, tap, catchError, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { TmdbSearchService, TmdbMultiSearchResultDto } from '../services/tmdb-search.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { SmartSearchService } from '../services/smart-search.service';
import { DatabaseService } from '../database/database.service';

interface SearchState {
    query: string;
    results: TmdbMultiSearchResultDto[];
    isLoading: boolean;
    isAppending: boolean;
    error: string | null;
    page: number;
    hasMore: boolean;
    recentSearches: string[];
    // Smart Search States
    smartResults: TmdbMultiSearchResultDto[];
    isSmartSearching: boolean;
    smartSearchReady: boolean;
    showSmartUI: boolean;
}

const initialState: SearchState = {
    query: '',
    results: [],
    isLoading: false,
    isAppending: false,
    error: null,
    page: 1,
    hasMore: false,
    recentSearches: [],
    // Smart Search States
    smartResults: [],
    isSmartSearching: false,
    smartSearchReady: false,
    showSmartUI: false
};

export const SearchStore = signalStore(
    withState(initialState),
    withMethods((
        store, 
        searchService = inject(TmdbSearchService), 
        moviesService = inject(TmdbMoviesService),
        peopleService = inject(TmdbPeopleService),
        tvService = inject(TmdbTvService),
        smartSearchService = inject(SmartSearchService),
        dbService = inject(DatabaseService)
    ) => {
        
        const saveRecentSearch = async (query: string): Promise<void> => {
            if (!query.trim()) return;
            try {
                await dbService.db.searchHistory.upsert({
                    query: query.trim(),
                    timestamp: Date.now()
                });
                const docs = await dbService.db.searchHistory.find({
                    sort: [{ timestamp: 'desc' }],
                    limit: 10
                }).exec();
                patchState(store, { recentSearches: docs.map(d => d.query) });
            } catch (e) {
                console.error('Failed to save search', e);
            }
        };

        const hydrateMissingImages = async (results: TmdbMultiSearchResultDto[]): Promise<void> => {
            // Find "Ghost Records" (results that have no poster or profile path)
            const ghostRecords = results.filter(item => {
                if (item.media_type === 'person') return !item.profile_path;
                return !(item as { poster_path?: string }).poster_path;
            });

            if (!ghostRecords.length) return;

            // In order to avoid hammering TMDB and Wikipedia, we run these lookups concurrently
            // We use standard Promise.all here directly for the async block instead of heavy RxJS streams
            await Promise.allSettled(
                ghostRecords.map(async (ghost) => {
                    try {
                        let wikidataId: string | null = null;

                        // 1. Fetch External IDs depending on media type
                        if (ghost.media_type === 'movie') {
                            const ids = await firstValueFrom(moviesService.getMovieExternalIds(ghost.id));
                            wikidataId = ids.wikidata_id;
                        } else if (ghost.media_type === 'tv') {
                            const ids = await firstValueFrom(tvService.getTvExternalIds(ghost.id));
                            wikidataId = ids.wikidata_id;
                        } else if (ghost.media_type === 'person') {
                            const ids = await firstValueFrom(peopleService.getPersonExternalIds(ghost.id));
                            wikidataId = ids.wikidata_id;
                        }

                        // 2. Fetch Wikidata Image if ID exists
                        if (wikidataId) {
                            const wikiImageUrl = await firstValueFrom(searchService.getWikidataImage(wikidataId));
                            
                            // 3. Patch the specific record in memory if successful
                            if (wikiImageUrl) {
                                patchState(store, (state) => ({
                                    results: state.results.map(item => {
                                        if (item.id === ghost.id && item.media_type === ghost.media_type) {
                                            return {
                                                ...item,
                                                // We hijack the TMDB properties and forcefully inject the Wiki URL
                                                ...(item.media_type === 'person' 
                                                    ? { profile_path: wikiImageUrl } 
                                                    : { poster_path: wikiImageUrl })
                                            };
                                        }
                                        return item;
                                    })
                                }));
                            }
                        }
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (_e) {
                        // Silently fail if Wikidata/External IDs fails, leaving the placeholder intact!
                        console.debug(`Hydration failed for ghost record ${ghost.id}`);
                    }
                })
            );
        };

        return {
            async saveSearchToHistory(query: string): Promise<void> {
                await saveRecentSearch(query);
            },

            async loadRecentSearches(): Promise<void> {
                try {
                    const docs = await dbService.db.searchHistory.find({
                        sort: [{ timestamp: 'desc' }],
                        limit: 10
                    }).exec();
                    
                    patchState(store, { recentSearches: docs.map(d => d.query) });
                } catch (e) {
                    console.error('Failed to load recent searches', e);
                }
            },

            async clearRecentSearches(): Promise<void> {
                try {
                    const docs = await dbService.db.searchHistory.find().exec();
                    if (docs.length > 0) {
                        for(const doc of docs) {
                           await doc.remove();
                        }
                    }
                    patchState(store, { recentSearches: [] });
                } catch (error) {
                    console.error('Failed to clear search history', error);
                }
            },
            
            async removeRecentSearch(query: string): Promise<void> {
                try {
                    const doc = await dbService.db.searchHistory.findOne(query).exec();
                    if (doc) {
                        await doc.remove();
                    }
                    const docs = await dbService.db.searchHistory.find({
                        sort: [{ timestamp: 'desc' }],
                        limit: 10
                    }).exec();
                    patchState(store, { recentSearches: docs.map(d => d.query) });
                } catch (error) {
                    console.error('Failed to remove recent search', error);
                }
            },

            toggleSmartSearch(): void {
                if (store.smartSearchReady()) {
                    patchState(store, { showSmartUI: !store.showSmartUI() });
                }
            },

            // RxMethod to elegantly handle rapid typing with debounce and cancellation
            searchQuery: rxMethod<string>(
                pipe(
                    debounceTime(350),
                    distinctUntilChanged(),
                    tap((query) => {
                        patchState(store, { query, page: 1, error: null });
                        if (!query.trim()) {
                            patchState(store, { 
                                results: [], isLoading: false, hasMore: false,
                                isSmartSearching: false, smartSearchReady: false, showSmartUI: false, smartResults: []
                            });
                        } else {
                            patchState(store, { isLoading: true });
                        }
                    }),
                    switchMap((query) => {
                        if (!query.trim()) {
                            return of(null);
                        }
                        return searchService.searchMulti(query, 1).pipe(
                            tap({
                                next: (res) => {
                                    patchState(store, {
                                        results: res.results || [],
                                        isLoading: false,
                                        hasMore: res.page < res.total_pages
                                    });
                                    // Kick off the background hydration without awaiting it
                                    // This lets the UI render the grid immediately, then fade-in wiki images later
                                    hydrateMissingImages(res.results || []);
                                },
                                error: (err) => {
                                    console.error('Search error', err);
                                    patchState(store, { error: 'Failed to load search results', isLoading: false });
                                }
                            }),
                            catchError(() => of(null))
                        );
                    })
                )
            ),

            // Separate AI RxMethod to execute concurrently with standard search
            smartSearchQuery: rxMethod<string>(
                pipe(
                    // Huge debounce so we don't spam expensive Gemini API until the user *really* pauses
                    debounceTime(800),
                    distinctUntilChanged(),
                    tap((query) => {
                        if (!query.trim() || query.trim().length < 5) {
                            // Too short for AI inference, reset UI
                            patchState(store, { isSmartSearching: false, smartSearchReady: false, showSmartUI: false, smartResults: [] });
                        } else {
                            patchState(store, { isSmartSearching: true, smartSearchReady: false, showSmartUI: false, smartResults: [] });
                        }
                    }),
                    switchMap((query) => {
                        if (!query.trim() || query.trim().length < 5) return of(null);
                        
                        return smartSearchService.getSmartSuggestions(query).pipe(
                            switchMap(suggestionRes => {
                                const titles = suggestionRes.titles || [];
                                if (titles.length === 0) {
                                    // Gemini returned no robust answers
                                    patchState(store, { isSmartSearching: false, smartSearchReady: false });
                                    return of(null);
                                }

                                // We have top-level titles (strings). Time to fetch explicit TMDB posters for them!
                                // For precision, we use Promise.all to map over the array concurrently
                                return [titles]; // Passing to mapping pipeline below
                            }),
                            tap({
                                next: async (titlesArray) => {
                                    if (!titlesArray) return;
                                    
                                    try {
                                        // Execute consecutive multi-searches for each returned AI string, grabbing the very first (most relevant) match
                                        const fetches = titlesArray.map(async title => {
                                            const tmdbRes = await firstValueFrom(searchService.searchMulti(title, 1));
                                            return tmdbRes.results && tmdbRes.results.length > 0 ? tmdbRes.results[0] : null;
                                        });

                                        const populatedEntities = (await Promise.all(fetches)).filter(i => i) as TmdbMultiSearchResultDto[];

                                        patchState(store, {
                                            smartResults: populatedEntities,
                                            isSmartSearching: false,
                                            smartSearchReady: populatedEntities.length > 0
                                        });

                                        hydrateMissingImages(populatedEntities);
                                        
                                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                    } catch(_e) {
                                        // Silent fail ensures normal search isn't interrupted
                                        console.error('Failed to populate Gemini titles via TMDB');
                                        patchState(store, { isSmartSearching: false, smartSearchReady: false });
                                    }
                                },
                                error: (err) => {
                                    console.error('Gemini API Error', err);
                                    patchState(store, { isSmartSearching: false, smartSearchReady: false });
                                }
                            }),
                            catchError(() => {
                                patchState(store, { isSmartSearching: false });
                                return of(null);
                            })
                        );
                    })
                )
            ),

            // Method intended for an Infinite Scroll trigger
            async loadNextPage(): Promise<void> {
                if (store.isLoading() || store.isAppending() || !store.hasMore() || !store.query().trim()) {
                    return;
                }
                
                const nextPage = store.page() + 1;
                patchState(store, { isAppending: true });
                
                try {
                    const res = await firstValueFrom(searchService.searchMulti(store.query(), nextPage));
                    if (res) {
                        patchState(store, {
                            results: [...store.results(), ...(res.results || [])],
                            page: nextPage,
                            hasMore: res.page < res.total_pages,
                            isAppending: false
                        });
                        // Kick off append hydration
                        hydrateMissingImages(res.results || []);
                    }
                } catch (error) {
                    console.error('Failed to append search results', error);
                    patchState(store, { isAppending: false, error: 'Failed to load more results' });
                }
            }
        };
    })
);
