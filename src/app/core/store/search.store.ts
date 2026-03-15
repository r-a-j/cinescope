import { inject, DestroyRef } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { HttpErrorResponse } from '@angular/common/http';
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
    showSmartUI: boolean;
    smartSearchError: string | null;
    lastSmartQuery: string | null;
    smartSearchRetryTimer: number;
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
    showSmartUI: false,
    smartSearchError: null,
    lastSmartQuery: null,
    smartSearchRetryTimer: 0
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
        dbService = inject(DatabaseService),
        destroyRef = inject(DestroyRef)
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
                        for (const doc of docs) {
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
                if (store.lastSmartQuery() === store.query() && store.smartResults().length > 0) {
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
                                isSmartSearching: false, showSmartUI: false, smartResults: [],
                                smartSearchError: null, lastSmartQuery: null, smartSearchRetryTimer: 0
                            });
                        } else {
                            patchState(store, { isLoading: true });
                            // Hide the smart UI if they change queries while it's active
                            if (store.showSmartUI()) {
                                patchState(store, { showSmartUI: false });
                            }
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
            // Explicit AI execution method (triggered by button click, not debounce)
            async executeSmartSearch(): Promise<void> {
                console.log('[Store - Smart Search] Executing Smart Search for:', store.query());

                // ChatGPT Style Guard: ONLY ONE click allowed per generation round, and obey quota locks.
                if (store.isSmartSearching() || store.smartSearchRetryTimer() > 0) {
                    console.warn('[Store - Smart Search] Execution blocked due to active search or quota lock.');
                    return;
                }

                const currentQuery = store.query();
                if (!currentQuery.trim() || currentQuery.trim().length < 5) return;

                patchState(store, {
                    isSmartSearching: true,
                    showSmartUI: false,
                    smartResults: [],
                    smartSearchError: null,
                    lastSmartQuery: currentQuery
                });

                try {
                    const suggestionRes = await firstValueFrom(smartSearchService.getSmartSuggestions(currentQuery));
                    const entities = suggestionRes.entities || [];

                    if (entities.length === 0) {
                        patchState(store, {
                            isSmartSearching: false,
                            smartSearchError: "AI couldn't find exact cinematic matches. Try rewording."
                        });
                        return;
                    }

                    // Concurrently route the AI's intent to the perfect TMDB endpoint
                    const fetches = entities.map(async entity => {
                        let tmdbRes;
                        switch (entity.type) {
                            case 'movie':
                                tmdbRes = await firstValueFrom(
                                    searchService.searchMovies(entity.query, 1, 'en-US', false, entity.year?.toString())
                                );
                                break;
                            case 'tv':
                                tmdbRes = await firstValueFrom(
                                    searchService.searchTvShows(entity.query, 1, 'en-US', false, entity.year)
                                );
                                break;
                            case 'person':
                                tmdbRes = await firstValueFrom(
                                    searchService.searchPerson(entity.query, 1)
                                );
                                break;
                            default:
                                tmdbRes = await firstValueFrom(searchService.searchMulti(entity.query, 1));
                        }
                        if (tmdbRes.results && tmdbRes.results.length > 0) {
                            const match = tmdbRes.results[0] as TmdbMultiSearchResultDto;
                            // Critical Fix: TMDB isolated endpoints (/movie, /tv) do not append 'media_type' natively.
                            // We MUST append it manually so the Angular HTML @switch block can structurally render them!
                            match.media_type = entity.type as 'movie' | 'tv' | 'person';
                            return match;
                        }
                        
                        return null;
                    });

                    const populatedEntities = (await Promise.all(fetches)).filter(i => i) as TmdbMultiSearchResultDto[];

                    patchState(store, {
                        smartResults: populatedEntities,
                        isSmartSearching: false,
                        showSmartUI: populatedEntities.length > 0
                    });

                    // Hydrate missing AI images too!
                    hydrateMissingImages(populatedEntities);

                } catch (error: unknown) {
                    console.error('[Store - Smart Search] Gemini Backend Request Failed:', error);

                    let errorMsg = 'Failed to execute AI search.';
                    let retryTimer = 0;

                    if (error instanceof HttpErrorResponse) {
                        if (error.status === 429) {
                            errorMsg = 'Too many AI requests. Please slow down.';
                            retryTimer = error.error?.retryAfter || 60; // Use exactly what Vercel sends, else 60s
                        } else if (error.status === 500) {
                            errorMsg = 'AI Backend experienced an issue.';
                        } else if (error.status === 504) {
                            errorMsg = 'AI Request timed out.';
                        }
                    }

                    patchState(store, {
                        isSmartSearching: false,
                        smartSearchError: errorMsg,
                        smartSearchRetryTimer: retryTimer
                    });

                    // ChatGPT Style Execution Lock: Start the live countdown!
                    if (retryTimer > 0) {
                        const intervalId = setInterval(() => {
                            const current = store.smartSearchRetryTimer();
                            if (current <= 1) {
                                clearInterval(intervalId);
                                patchState(store, { smartSearchRetryTimer: 0, smartSearchError: null });
                            } else {
                                patchState(store, { smartSearchRetryTimer: current - 1 });
                            }
                        }, 1000);

                        destroyRef.onDestroy(() => clearInterval(intervalId));
                    }
                }
            },

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