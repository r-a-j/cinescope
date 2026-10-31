import { inject, DestroyRef, computed } from '@angular/core';
import { patchState, signalStore, withMethods, withState, withComputed } from '@ngrx/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, pipe, switchMap, tap, catchError, of, forkJoin, map, Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { TmdbSearchService, TmdbMultiSearchResultDto } from '../services/tmdb-search.service';
import { TmdbCollectionListItemDto } from '../dtos/collections/collection-list-item.dto';
import { TmdbMoviesService } from '../services/tmdb-movies.service';
import { TmdbPeopleService } from '../services/tmdb-people.service';
import { TmdbTvService } from '../services/tmdb-tv.service';
import { SmartSearchService, SemanticIntentSection } from '../services/smart-search.service';
import { DatabaseService } from '../database/database.service';
import { TmdbDiscoverService } from '../services/tmdb-discover.service';
import { generateSearchTitleVariations } from '../utils/search-fuzzy.util';

function getMinimumReleaseDate(query: string): string | null {
    const explicitRange = query.match(/\b(?:from|since)\s+(19\d{2}|20\d{2})\s+(?:onwards?|forward|and\s+(?:up|later)|or\s+(?:later|newer))\b/i);
    const sinceYear = query.match(/\bsince\s+(19\d{2}|20\d{2})\b/i);
    const suffixedYear = query.match(/\b(19\d{2}|20\d{2})\s*(?:\+|onwards?|and\s+(?:up|later)|or\s+(?:later|newer))\b/i);
    const afterYear = query.match(/\bafter\s+(19\d{2}|20\d{2})\b/i);
    const minimumYear = explicitRange?.[1] ?? sinceYear?.[1] ?? suffixedYear?.[1];

    if (minimumYear) {
        return `${minimumYear}-01-01`;
    }

    if (afterYear?.[1]) {
        return `${Number(afterYear[1]) + 1}-01-01`;
    }

    return null;
}

export type CategorizedSearchResult = TmdbMultiSearchResultDto & { smart_category?: string };
export type SearchFilter = 'all' | 'movie' | 'tv' | 'collection' | 'person';

interface SearchState {
    query: string;
    cleanQuery: string;
    correctedQuery: string | null;
    sortIntent: 'latest' | 'oldest' | 'rating' | null;
    activeFilter: SearchFilter;
    results: TmdbMultiSearchResultDto[];
    collectionResults: TmdbCollectionListItemDto[];
    isSearchingCollections: boolean;
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
    correctedQuery: null,
    sortIntent: null,
    activeFilter: 'all',
    results: [],
    collectionResults: [],
    isSearchingCollections: false,
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
    { providedIn: 'root' },
    withState(initialState),
    withComputed(({ smartResults, results, collectionResults, activeFilter }) => ({
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
        }),
        filteredResults: computed(() => {
            const filter = activeFilter();
            const list = results();
            if (filter === 'all' || filter === 'collection') {
                return list;
            }
            return list.filter(item => item.media_type === filter);
        }),
        topCollectionSpotlight: computed(() => {
            const collections = collectionResults();
            return collections.length > 0 ? collections[0] : null;
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
                const db = await dbService.getDatabase();
                await db.searchHistory.upsert({
                    query: query.trim(),
                    timestamp: Date.now()
                });
                const docs = await db.searchHistory.find({
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

                            // 3. Patch the specific record in memory if successful (both standard & smart results)
                            if (wikiImageUrl) {
                                const patchItem = <T extends TmdbMultiSearchResultDto>(item: T): T => {
                                    if (item.id === ghost.id && item.media_type === ghost.media_type) {
                                        return {
                                            ...item,
                                            ...(item.media_type === 'person'
                                                ? { profile_path: wikiImageUrl }
                                                : { poster_path: wikiImageUrl })
                                        };
                                    }
                                    return item;
                                };

                                patchState(store, (state) => ({
                                    results: state.results.map(patchItem),
                                    smartResults: state.smartResults.map(patchItem)
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
                    const db = await dbService.getDatabase();
                    const docs = await db.searchHistory.find({
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
                    const db = await dbService.getDatabase();
                    const docs = await db.searchHistory.find().exec();
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
                    const db = await dbService.getDatabase();
                    const doc = await db.searchHistory.findOne(query).exec();
                    if (doc) {
                        await doc.remove();
                    }
                    const docs = await db.searchHistory.find({
                        sort: [{ timestamp: 'desc' }],
                        limit: 10
                    }).exec();
                    patchState(store, { recentSearches: docs.map(d => d.query) });
                } catch (error) {
                    console.error('Failed to remove recent search', error);
                }
            },

            setActiveFilter(filter: SearchFilter): void {
                patchState(store, { activeFilter: filter });
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
                        patchState(store, { query, page: 1, error: null, correctedQuery: null });
                        if (!query.trim()) {
                            patchState(store, {
                                results: [], collectionResults: [], isLoading: false, isSearchingCollections: false, hasMore: false,
                                correctedQuery: null,
                                isSmartSearching: false, showSmartUI: false, smartResults: [],
                                smartSearchError: null, lastSmartQuery: null, smartSearchRetryTimer: 0
                            });
                        } else {
                            patchState(store, { isLoading: true, isSearchingCollections: true });
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

                        // --- V5 DETERMINISTIC QUERY INTENT COMPILER ---
                        let cleanQuery = query.toLowerCase();
                        let sortIntent: 'latest' | 'oldest' | 'rating' | null = null;
                        let extractedYear: number | null = null;

                        // 1. Extract Sorting Keywords
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

                        // 2. Extract 4-digit release year (e.g. "Batman 2022" -> query "Batman", boost 2022)
                        const yearMatch = cleanQuery.match(/\b(19\d\d|20\d\d)\b/);
                        if (yearMatch && yearMatch[1]) {
                            extractedYear = parseInt(yearMatch[1], 10);
                            const stripped = cleanQuery.replace(/\b(19\d\d|20\d\d)\b/g, '').trim();
                            if (stripped.length >= 2) {
                                cleanQuery = stripped;
                            }
                        }

                        if (!cleanQuery) cleanQuery = query;

                        patchState(store, { sortIntent, cleanQuery });

                        // Search TMDB collections in parallel for dedicated franchise tab & spotlight
                        const collectionQuery = cleanQuery
                            .replace(/\b(saga|franchise|series|trilogy|quadrilogy|duology)\b/gi, '')
                            .replace(/\s+/g, ' ')
                            .trim() || cleanQuery;

                        searchService.searchCollections(collectionQuery, 1).pipe(
                            catchError(() => of({ results: [], page: 1, total_pages: 1, total_results: 0 }))
                        ).subscribe({
                            next: (colRes) => {
                                // Guard against stale responses if user changed or cleared query
                                if (store.query() !== query) return;
                                patchState(store, {
                                    collectionResults: colRes.results || [],
                                    isSearchingCollections: false
                                });
                            }
                        });

                        return searchService.searchMulti(cleanQuery, 1).pipe(
                            switchMap((res) => {
                                const items = res.results || [];
                                if (items.length > 0 || cleanQuery.length < 3) {
                                    return of({ res, matchedQuery: null as string | null });
                                }

                                // Stage 1: Algorithmic typo & phonetic variations (dropped vowels, swaps, Hinglish, German)
                                const variations = generateSearchTitleVariations(cleanQuery).slice(0, 4);
                                const trySpellService = (): Observable<{ res: typeof res; matchedQuery: string | null }> => {
                                    if (typeof searchService.getSpellingSuggestion !== 'function') {
                                        return of({ res, matchedQuery: null as string | null });
                                    }
                                    return searchService.getSpellingSuggestion(cleanQuery).pipe(
                                        switchMap((suggestion) => {
                                            if (!suggestion || suggestion.toLowerCase() === cleanQuery.toLowerCase()) {
                                                return of({ res, matchedQuery: null as string | null });
                                            }
                                            return searchService.searchMulti(suggestion, 1).pipe(
                                                map((sugRes) => ({
                                                    res: (sugRes.results?.length ?? 0) > 0 ? sugRes : res,
                                                    matchedQuery: (sugRes.results?.length ?? 0) > 0 ? suggestion : null
                                                })),
                                                catchError(() => of({ res, matchedQuery: null as string | null }))
                                            );
                                        }),
                                        catchError(() => of({ res, matchedQuery: null as string | null }))
                                    );
                                };

                                if (variations.length === 0) {
                                    return trySpellService();
                                }

                                const candidateCalls = variations.map((variant) =>
                                    searchService.searchMulti(variant, 1).pipe(
                                        map((vRes) => ({ variant, vRes })),
                                        catchError(() => of({ variant, vRes: res }))
                                    )
                                );

                                return forkJoin(candidateCalls).pipe(
                                    switchMap((outcomes) => {
                                        const hit = outcomes.find((o) => (o.vRes.results?.length ?? 0) > 0);
                                        if (hit) {
                                            return of({ res: hit.vRes, matchedQuery: hit.variant });
                                        }
                                        // Stage 2: Public zero-key spellcheck suggestion fallback (Wikipedia / Datamuse)
                                        return trySpellService();
                                    })
                                );
                            }),
                            tap({
                                next: ({ res, matchedQuery }) => {
                                    if (matchedQuery) {
                                        patchState(store, {
                                            correctedQuery: matchedQuery,
                                            cleanQuery: matchedQuery
                                        });

                                        // Also heal collection search if initial typo returned 0 collections
                                        if (store.collectionResults().length === 0) {
                                            searchService.searchCollections(matchedQuery, 1).pipe(
                                                catchError(() => of({ results: [], page: 1, total_pages: 1, total_results: 0 }))
                                            ).subscribe((colRes) => {
                                                if (store.query() !== query) return;
                                                if ((colRes.results?.length ?? 0) > 0) {
                                                    patchState(store, { collectionResults: colRes.results });
                                                }
                                            });
                                        }
                                    }

                                    let finalResults = res.results || [];

                                    // If user specified an explicit year, boost matching release year to the top
                                    if (extractedYear && finalResults.length > 0) {
                                        const yearStr = String(extractedYear);
                                        finalResults = [...finalResults].sort((a, b) => {
                                            const dateA = a.media_type === 'movie' ? a.release_date : (a.media_type === 'tv' ? a.first_air_date : '');
                                            const dateB = b.media_type === 'movie' ? b.release_date : (b.media_type === 'tv' ? b.first_air_date : '');
                                            const aMatch = dateA?.startsWith(yearStr) ? 1 : 0;
                                            const bMatch = dateB?.startsWith(yearStr) ? 1 : 0;
                                            return bMatch - aMatch;
                                        });
                                    }

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
                    const minimumReleaseDate = getMinimumReleaseDate(currentQuery);

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

                            if (minimumReleaseDate) {
                                discoverParams[section.action === 'discover_movies'
                                    ? 'primary_release_date.gte'
                                    : 'first_air_date.gte'] = minimumReleaseDate;
                            }

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
                                tmdbItems = exactMatchRes.results.slice(0, 10).map(match => ({
                                    ...match,
                                    media_type: match.media_type || 'movie',
                                    smart_category: section.title
                                })) as CategorizedSearchResult[];
                            }
                        }

                        return tmdbItems;
                    });

                    // Flatten the array of arrays because Discover returns multiple items per section
                    const populatedEntities = (await Promise.all(fetches)).flat() as CategorizedSearchResult[];
                    const constrainedEntities = minimumReleaseDate
                        ? populatedEntities.filter((item) => {
                            if (item.media_type === 'person') return false;
                            const releaseDate = item.media_type === 'movie' ? item.release_date : item.first_air_date;
                            return Boolean(releaseDate && releaseDate >= minimumReleaseDate);
                        })
                        : populatedEntities;

                    patchState(store, {
                        smartResults: constrainedEntities,
                        isSmartSearching: false,
                        showSmartUI: constrainedEntities.length > 0
                    });

                    // Hydrate missing AI images too!
                    hydrateMissingImages(constrainedEntities);

                } catch (error: unknown) {
                    console.error('[Store - Smart Search] Gemini Backend Request Failed:', error);

                    let errorMsg = 'Failed to execute AI search.';
                    let retryTimer = 0;

                    if (error instanceof HttpErrorResponse) {
                        if (error.status === 429) {
                            errorMsg = 'Too many AI requests. Please slow down.';
                            retryTimer = error.error?.retryAfter || 60; // Use exactly what Vercel sends, else 60s
                        } else if (error.status === 503) {
                            errorMsg = error.error?.error || 'AI is experiencing high demand. Please try again shortly.';
                            retryTimer = error.error?.retryAfter || 5;
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