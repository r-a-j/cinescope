import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { debounceTime, distinctUntilChanged, pipe, switchMap, tap, catchError, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { TmdbSearchService, TmdbMultiSearchResultDto } from '../services/tmdb-search.service';
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
}

const initialState: SearchState = {
    query: '',
    results: [],
    isLoading: false,
    isAppending: false,
    error: null,
    page: 1,
    hasMore: false,
    recentSearches: []
};

export const SearchStore = signalStore(
    withState(initialState),
    withMethods((store, searchService = inject(TmdbSearchService), dbService = inject(DatabaseService)) => {
        
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

        const sortResults = (results: TmdbMultiSearchResultDto[]): TmdbMultiSearchResultDto[] => {
            if (!results) return [];
            return [...results].sort((a, b) => {
                const hasImageA = a.media_type === 'person' ? !!a.profile_path : !!(a as { poster_path?: string }).poster_path;
                const hasImageB = b.media_type === 'person' ? !!b.profile_path : !!(b as { poster_path?: string }).poster_path;
                
                if (hasImageA && !hasImageB) return -1;
                if (!hasImageA && hasImageB) return 1;
                return 0;
            });
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

            // RxMethod to elegantly handle rapid typing with debounce and cancellation
            searchQuery: rxMethod<string>(
                pipe(
                    debounceTime(350),
                    distinctUntilChanged(),
                    tap((query) => {
                        patchState(store, { query, page: 1, error: null });
                        if (!query.trim()) {
                            patchState(store, { results: [], isLoading: false, hasMore: false });
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
                                        results: sortResults(res.results || []),
                                        isLoading: false,
                                        hasMore: res.page < res.total_pages
                                    });
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
                            results: sortResults([...store.results(), ...(res.results || [])]),
                            page: nextPage,
                            hasMore: res.page < res.total_pages,
                            isAppending: false
                        });
                    }
                } catch (error) {
                    console.error('Failed to append search results', error);
                    patchState(store, { isAppending: false, error: 'Failed to load more results' });
                }
            }
        };
    })
);
