import { inject, DestroyRef, computed } from '@angular/core';
import { patchState, signalStore, withMethods, withState, withComputed } from '@ngrx/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, pipe, switchMap, tap, catchError, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { TmdbSearchService, TmdbMultiSearchResultDto } from '../services/tmdb-search.service';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { SmartSearchService, SemanticIntentSection } from '../services/smart-search.service';
import { DatabaseService } from '../database/database.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';

export type CategorizedSearchResult = TmdbMultiSearchResultDto & { smart_category?: string };

interface SearchState {
    query: string;
    cleanQuery: string;
    sortIntent: 'latest' | 'oldest' | 'rating' | null;
    results: TmdbMultiSearchResultDto[];
    isLoading: boolean;
    isAppending: boolean;
    error: string | null;
    page: number;
    hasMore: boolean;
    recentSearches: string[];
    // Smart Search States
    smartResults: CategorizedSearchResult[];
    isSmartSearching: boolean;
    showSmartUI: boolean;
    smartSearchError: string | null;
    lastSmartQuery: string | null;
    smartSearchRetryTimer: number;
}

const initialState: SearchState = {
    query: '',
    cleanQuery: '',
    sortIntent: null,
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
    withComputed(({ smartResults }) => ({
        smartResultGroups: computed(() => {
            const groups = new Map<string, CategorizedSearchResult[]>();
            smartResults().forEach(item => {
                const category = item.smart_category || 'Top Results';
                const items = groups.get(category) || [];
                items.push(item);
                groups.set(category, items);
            });
            // Re-map Map into iterable arrays for the Angular HTML loop
            return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
        })
    })),
    withMethods((
        store,
        searchService = inject(TmdbSearchService),
        moviesService = inject(TmdbMoviesService),
        peopleService = inject(TmdbPeopleService),
        tvService = inject(TmdbTvService),
        discoverService = inject(TmdbDiscoverService),
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

                        // --- V4 NLP DETERMINISTIC INTERCEPTOR ---
                        let cleanQuery = query.toLowerCase();
                        let sortIntent: 'latest' | 'oldest' | 'rating' | null = null;

                        if (/\b(latest|newest|new)\b/i.test(cleanQuery)) {
                            sortIntent = 'latest';
                            cleanQuery = cleanQuery.replace(/\b(latest|newest|new)\b/ig, '').trim();
                        } else if (/\b(oldest|first)\b/i.test(cleanQuery)) {
                            sortIntent = 'oldest';
                            cleanQuery = cleanQuery.replace(/\b(oldest|first)\b/ig, '').trim();
                        } else if (/\b(best|top rated)\b/i.test(cleanQuery)) {
                            sortIntent = 'rating';
                            cleanQuery = cleanQuery.replace(/\b(best|top rated)\b/ig, '').trim();
                        }

                        if (!cleanQuery) cleanQuery = query;

                        patchState(store, { sortIntent, cleanQuery });

                        return searchService.searchMulti(cleanQuery, 1).pipe(
                            tap({
                                next: (res) => {
                                    let finalResults = res.results || [];

                                    if (sortIntent && finalResults.length > 0) {
                                        finalResults = [...finalResults].sort((a, b) => {
                                            if (sortIntent === 'rating') {
                                                const ratingA = a.media_type === 'person' ? 0 : (a.vote_average || 0);
                                                const ratingB = b.media_type === 'person' ? 0 : (b.vote_average || 0);
                                                return ratingB - ratingA;
                                            } else {
                                                const dateA = a.media_type === 'movie' ? a.release_date : (a.media_type === 'tv' ? a.first_air_date : '');
                                                const dateB = b.media_type === 'movie' ? b.release_date : (b.media_type === 'tv' ? b.first_air_date : '');
                                                const timeA = dateA ? new Date(dateA).getTime() : 0;
                                                const timeB = dateB ? new Date(dateB).getTime() : 0;
                                                
                                                if (sortIntent === 'latest') return timeB - timeA;
                                                
                                                if (!timeA && !timeB) return 0;
                                                if (!timeA) return 1;
                                                if (!timeB) return -1;
                                                return timeA - timeB;
                                            }
                                        });
                                    }

                                    patchState(store, {
                                        results: finalResults,
                                        isLoading: false,
                                        hasMore: res.page < res.total_pages
                                    });
                                    // Kick off the background hydration without awaiting it
                                    hydrateMissingImages(finalResults);
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
                    const sections: SemanticIntentSection[] = suggestionRes.sections || [];

                    if (sections.length === 0) {
                        patchState(store, {
                            isSmartSearching: false,
                            smartSearchError: "AI couldn't deduce an actionable API execution graph. Try rewording."
                        });
                        return;
                    }

                    // Concurrently route the AI's intent to the perfect TMDB endpoint based on the Execution Graph
                    const fetches = sections.map(async (section: SemanticIntentSection) => {
                        let tmdbItems: TmdbMultiSearchResultDto[] = [];
                        
                        // Scenario 1 & 2: Discover Engine
                        if (section.action === 'discover_movies' || section.action === 'discover_tv') {
                            const discoverParams: Record<string, string | number | boolean> = {
                                sort_by: section.parameters.sort_by || 'popularity.desc',
                                page: 1
                            };

                            // Resolve 'person_name' to TMDB Actor ID invisibly
                            if (section.parameters.person_name) {
                                const personSearch = await firstValueFrom(searchService.searchPerson(section.parameters.person_name, 1));
                                if (personSearch.results && personSearch.results.length > 0) {
                                    discoverParams['with_cast'] = personSearch.results[0].id.toString();
                                }
                            }

                            if (section.parameters.genres?.length) {
                                discoverParams['with_genres'] = section.parameters.genres.join(',');
                            }

                            // Resolve 'keywords' strings into TMDB Keyword IDs invisibly
                            if (section.parameters.keywords?.length) {
                                const keywordFetches = section.parameters.keywords.map(async kw => {
                                    const kwRes = await firstValueFrom(searchService.searchKeywords(kw, 1));
                                    return (kwRes.results && kwRes.results.length > 0) ? kwRes.results[0].id : null;
                                });
                                const keywordIds = (await Promise.all(keywordFetches)).filter(id => id !== null);
                                if (keywordIds.length > 0) {
                                    discoverParams['with_keywords'] = keywordIds.join('|'); // OR logic for keywords
                                }
                            }

                            // Execute Final Orchestrated Graph
                            if (section.action === 'discover_movies') {
                                const discoverRes = await firstValueFrom(discoverService.discoverMovies(discoverParams));
                                if (discoverRes.results) {
                                  tmdbItems = discoverRes.results.map(movie => ({
                                      ...movie,
                                      media_type: 'movie' as const,
                                      smart_category: section.title
                                  })) as CategorizedSearchResult[];
                                }
                            } else {
                                const discoverRes = await firstValueFrom(discoverService.discoverTv(discoverParams));
                                if (discoverRes.results) {
                                    tmdbItems = discoverRes.results.map(tv => ({
                                        ...tv,
                                        media_type: 'tv' as const,
                                        smart_category: section.title
                                    })) as CategorizedSearchResult[];
                                }
                            }
                        } 
                        // Scenario 3: Legacy Exact Title Match Override
                        else if (section.action === 'exact_match' && section.parameters.query) {
                            const exactMatchRes = await firstValueFrom(searchService.searchMulti(section.parameters.query, 1));
                            if (exactMatchRes.results && exactMatchRes.results.length > 0) {
                                const match = exactMatchRes.results[0] as CategorizedSearchResult;
                                // Critical Fix: Manual schema padding for Angular Grid
                                match.media_type = match.media_type || 'movie'; 
                                match.smart_category = section.title;
                                tmdbItems = [match];
                            }
                        }

                        return tmdbItems;
                    });

                    // Flatten the array of arrays because Discover returns multiple items per section
                    const populatedEntities = (await Promise.all(fetches)).flat() as CategorizedSearchResult[];

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
                    const res = await firstValueFrom(searchService.searchMulti(store.cleanQuery() || store.query(), nextPage));
                    if (res) {
                        let newResults = res.results || [];
                        const sortIntent = store.sortIntent();

                        if (sortIntent && newResults.length > 0) {
                            newResults = [...newResults].sort((a, b) => {
                                if (sortIntent === 'rating') {
                                    const ratingA = a.media_type === 'person' ? 0 : (a.vote_average || 0);
                                    const ratingB = b.media_type === 'person' ? 0 : (b.vote_average || 0);
                                    return ratingB - ratingA;
                                } else {
                                    const dateA = a.media_type === 'movie' ? a.release_date : (a.media_type === 'tv' ? a.first_air_date : '');
                                    const dateB = b.media_type === 'movie' ? b.release_date : (b.media_type === 'tv' ? b.first_air_date : '');
                                    const timeA = dateA ? new Date(dateA).getTime() : 0;
                                    const timeB = dateB ? new Date(dateB).getTime() : 0;
                                    
                                    if (sortIntent === 'latest') return timeB - timeA;
                                    
                                    if (!timeA && !timeB) return 0;
                                    if (!timeA) return 1;
                                    if (!timeB) return -1;
                                    return timeA - timeB;
                                }
                            });
                        }

                        patchState(store, {
                            results: [...store.results(), ...newResults],
                            page: nextPage,
                            hasMore: res.page < res.total_pages,
                            isAppending: false
                        });
                        // Kick off append hydration
                        hydrateMissingImages(newResults);
                    }
                } catch (error) {
                    console.error('Failed to append search results', error);
                    patchState(store, { isAppending: false, error: 'Failed to load more results' });
                }
            }
        };
    })
);