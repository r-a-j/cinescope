import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbPaginatedResponseDto } from '../../models/tmdb/common/paginated-response.dto';
import { TmdbCollectionListItemDto } from '../../models/tmdb/collections/collection-list-item.dto';
import { TmdbCompanyListItemDto } from '../../models/tmdb/companies/company-list-item.dto';
import { TmdbKeywordDto } from '../../models/tmdb/keywords/keyword.dto';
import { TmdbMovieListItemDto } from '../../models/tmdb/movies/movie-list-item.dto';
import { TmdbTvListItemDto } from '../../models/tmdb/tv/tv-list-item.dto';
import { TmdbPersonListItemDto } from '../../models/tmdb/find/find-results.dto';

/**
 * A union type representing the possible items returned by a multi-search.
 * You can discriminate these by checking the 'media_type' property.
 */
export type TmdbMultiSearchResultDto =
    | (TmdbMovieListItemDto & { media_type: 'movie' })
    | (TmdbTvListItemDto & { media_type: 'tv' })
    | (TmdbPersonListItemDto & { media_type: 'person' });

@Injectable({ providedIn: 'root' })
export class TmdbSearchService {
    constructor(private http: HttpClient) { }

    /**
     * Search for collections (movie franchises) by their original, translated, and alternative names.
     * * @productContext
     * - Scenario 26 (The "Franchise Headache"): Use this to capture broad searches like "Star Wars" or "James Bond" 
     * and route the user to a "Franchise GPS" UI that automatically organizes the movies in chronological or release order.
     * 
     * * **The Problem:** You want to finally watch the Marvel Cinematic Universe or *Star Wars*, but you have no idea what order to watch the 30+ properties in.
     * * **The Feature: "Franchise GPS."** A specialized UI for massive universes. One tap toggles the list between "Release Order," "Chronological Universe Timeline," or popular fan orders (like the "Machete Order").
     * 
     * * @param query The text query to search for.
     * @param page The page number to fetch (defaults to 1).
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param includeAdult Choose whether to include adult (pornography) content in the results (defaults to false).
     * @param region Optional ISO-3166-1 region code to filter release dates.
     * 
     * * **Pro-Tip for CINESCOPE**
     * If you are building a "Global Search Bar" in your app, you typically don't want to hit this endpoint first, because users usually search for individual movies.
     * 
     * Instead, this endpoint is best used dynamically as a "Did you mean the whole franchise?" suggestion. If a user types "Harry Potter" into the main movie search, your UI can quietly run searchCollections('Harry Potter') in the background. If a collection is found, you inject a special, glowing "View the Complete Collection" banner at the very top of their movie search results!
     */
    searchCollections(
        query: string,
        page: number = 1,
        language: string = 'en-US',
        includeAdult: boolean = false,
        region?: string
    ): Observable<TmdbPaginatedResponseDto<TmdbCollectionListItemDto>> {
        let params = new HttpParams()
            .set('query', query)
            .set('page', page.toString())
            .set('language', language)
            .set('include_adult', includeAdult.toString());

        if (region) {
            params = params.set('region', region);
        }

        return this.http.get<TmdbPaginatedResponseDto<TmdbCollectionListItemDto>>('/search/collection', { params });
    }

    /**
     * Search for companies by their original and alternative names.
     * * @productContext
     * - Scenario 168 (The "Studio Loyalist" Hub): Use this to let users search for indie darlings like "A24" or "NEON". 
     * Grab the returned `id` and feed it into the `with_companies` parameter of the Discover API to build a dedicated studio catalog page.
     * 
     * -   **The Problem:** A user loves the distinct visual style of "A24" films and wants to watch their entire catalog, but streaming services don't let you easily filter by the production studio.
     * -   **The Feature:** The user searches for "A24". CINESCOPE uses this **Search Company** endpoint to find the official company ID. The app then routes the user to a sleek "Studio Hub" page, using that ID in the TMDB `Discover` endpoint to populate a complete, chronological grid of every movie that studio has ever produced.
     * * @param query The text query to search for.
     * @param page The page number to fetch (defaults to 1).
     * 
     * * **Pro-Tip for CINESCOPE**
     * If you look at the JSON response example in the documentation, searching for "HBO" returns 22 different results, including "HBO Asia", "HBO Max", and "HBO Sports".
     * When building your search dropdown UI, you might want to sort these results in memory by assuming the shortest name string (e.g., "HBO") is the primary parent company the user is actually looking for, pushing the regional variants down the list!
     */
    searchCompanies(
        query: string,
        page: number = 1
    ): Observable<TmdbPaginatedResponseDto<TmdbCompanyListItemDto>> {
        const params = new HttpParams()
            .set('query', query)
            .set('page', page.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbCompanyListItemDto>>('/search/company', { params });
    }

    /**
     * On its own, this endpoint is useless. However, it is the fundamental building block for the Discover API. If a user wants to find movies about "time travel" and "artificial intelligence", you cannot just type those words into the standard Movie Search. You have to use this Keyword Search endpoint to get the exact integer IDs for those concepts, and then feed those IDs into the Discover endpoint's with_keywords parameter.
     * 
     * Search for keywords by their name to retrieve their TMDB IDs.
     * * @productContext
     * - Scenario 169 (The "Hyper-Niche Craving"): Use this endpoint to power an autocomplete tag-input field. 
     * As the user types "time tra...", query this endpoint to find the ID for "time travel". 
     * Collect those IDs and pass them to the Discover API's `with_keywords` parameter to build hyper-specific movie feeds.
     * 
     * -   **The Problem:** A user doesn't just want a "Sci-Fi" movie. They specifically want a "Cyberpunk" movie featuring "Artificial Intelligence" and a "Dystopia", but standard streaming apps only have broad, generic genre categories.
    
-   **The Feature:** "The Niche Blender." The user types tags into a search bar. CINESCOPE uses the **Search Keyword** endpoint to autocomplete their typing and grab the TMDB internal IDs for "Cyberpunk", "Artificial Intelligence", etc. It then invisibly passes those IDs to the Discover API to generate a hyper-specific, custom-tailored movie feed on the fly.
     * * @param query The text query to search for.
     * @param page The page number to fetch (defaults to 1).
     * 
     * * **Pro-Tip for CINESCOPE**
     * To make this feel like magic for your users, do not make them click a "Search" button for keywords. Hook up this searchKeywords method to an RxJS debounceTime(300) and switchMap operator in your Angular component. As they type into a tag-input box, it will smoothly fetch the keyword IDs in real-time, giving them a snappy, responsive "Niche Blender" experience!
     */
    searchKeywords(
        query: string,
        page: number = 1
    ): Observable<TmdbPaginatedResponseDto<TmdbKeywordDto>> {
        const params = new HttpParams()
            .set('query', query)
            .set('page', page.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbKeywordDto>>('/search/keyword', { params });
    }

    /**
     * Search for movies by their original, translated and alternative titles.
     * * @productContext
     * - Scenario 170 (The "Time Capsule" Search): Expose the `primaryReleaseYear` parameter in an "Advanced Search" 
     * UI filter so users can easily distinguish between remakes and originals (e.g., finding the 1982 "The Thing" vs the 2011 "The Thing").
     * 
     * -   **The Problem:** A user remembers a movie called "The Thing," but searching for it returns the 2011 prequel instead of the 1982 John Carpenter classic.
     * -   **The Feature:** By leveraging the `primary_release_year` and `year` parameters, CINESCOPE can offer an "Advanced Search" toggle. Users can type "The Thing" and slide a year selector to 1982, instantly filtering out remakes, reboots, and identically named films from other decades to find exactly what they want.

     * * @param query The text query to search for.
     * @param page The page number to fetch (defaults to 1).
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param includeAdult Choose whether to include adult content in the results (defaults to false).
     * @param primaryReleaseYear Optional year to strictly filter the primary release date.
     * @param year Optional year filter (looks at all release dates, not just primary).
     * @param region Optional ISO-3166-1 region code to filter release dates.
     * 
     * Pro-Tip for CINESCOPE
     * When you implement this search in your Angular UI, you should absolutely debounce the user's input. If a user is typing "F-I-G-H-T - C-L-U-B", you do not want to fire off 10 separate API calls to TMDB (which could throttle your API key).
     * Use RxJS operators to wait until the user stops typing for 300ms before triggering this searchMovies method!
     */
    searchMovies(
        query: string,
        page: number = 1,
        language: string = 'en-US',
        includeAdult: boolean = false,
        primaryReleaseYear?: string,
        year?: string,
        region?: string
    ): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        let params = new HttpParams()
            .set('query', query)
            .set('page', page.toString())
            .set('language', language)
            .set('include_adult', includeAdult.toString());

        if (primaryReleaseYear) params = params.set('primary_release_year', primaryReleaseYear);
        if (year) params = params.set('year', year);
        if (region) params = params.set('region', region);

        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>('/search/movie', { params });
    }

    /**
     * Search for movies, TV shows, and people in a single request.
     * * @productContext
     * - Scenario 171 (The "Omni-Search" Experience): Hook this up to the main navigation search bar. 
     * Map over the returned results and use a switch statement on `media_type` to render different UI cards 
     * -   **The Problem:** Users hate friction. If they type "Pedro Pascal," they don't want to first select a "People" tab. If they type "The Last of Us," they don't want to switch to a "TV" tab. They just want answers.
    
     -   **The Feature:** The Global Omni-Search Bar. Using the Multi Search endpoint, CINESCOPE can take a single query and return a mixed array. The UI can then instantly group the results: showing a circular avatar for Pedro Pascal (the person), and rectangular posters for _The Mandalorian_ (TV) and _Gladiator II_ (Movie), all in one beautiful dropdown.
     * (e.g., circular avatars for people, vertical posters for movies) all in the same autocomplete dropdown.
     * * @param query The text query to search for (Required).
     * @param page The page number to fetch (defaults to 1).
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param includeAdult Choose whether to include adult content in the results (defaults to false).
     * 
     * Pro-Tip for CINESCOPE
     * When you implement the template for this in Angular, TypeScript's strict typing is your best friend. 
     * Because we typed media_type literally as 'movie' | 'tv' | 'person', you can use an @switch or *ngSwitch block in your HTML.
     * Inside the *ngSwitchCase="'movie'", Angular will automatically know that the item has a title and a release_date. 
     * Inside the *ngSwitchCase="'tv'", Angular will know it has a name and first_air_date. This guarantees you won't get undefined rendering errors!
     */
    searchMulti(
        query: string,
        page: number = 1,
        language: string = 'en-US',
        includeAdult: boolean = false
    ): Observable<TmdbPaginatedResponseDto<TmdbMultiSearchResultDto>> {
        const params = new HttpParams()
            .set('query', query)
            .set('page', page.toString())
            .set('language', language)
            .set('include_adult', includeAdult.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbMultiSearchResultDto>>('/search/multi', { params });
    }

    /**
     * Search for people by their name and also known as names.
     * * @productContext
     * - Scenario 172 (The "Who Was That?" Resolver): Utilize the `known_for` array returned in the results 
     * to display miniature movie/TV posters alongside the actor's name in the search dropdown, providing 
     * instant visual confirmation for the user.
     * -   **The Problem:** A user recognizes an actor's face or remembers a partial name, but they aren't 100% sure if it's the right person until they see what movies they've been in. Clicking into every search result to check their filmography is tedious.
    
     -   **The Feature:** "Instant Context Search." Because this endpoint returns a `known_for` array containing the actor's top 3 most famous movies or TV shows directly in the search payload, CINESCOPE can display miniature movie posters right next to the actor's name in the autocomplete dropdown. The user instantly thinks, _"Ah yes, Tom Hanks from Forrest Gump!"_ and finds exactly who they were looking for without a single extra click.
     * * @param query The text query to search for (Required).
     * @param page The page number to fetch (defaults to 1).
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param includeAdult Choose whether to include adult content in the results (defaults to false).
     * 
     * Pro-Tip for CINESCOPE
     * If you decide to implement a dedicated "People Search" page rather than just a dropdown, you can use the popularity metric returned in this payload to your advantage.
     * If a user searches for a common name like "Chris," TMDB will return Chris Evans, Chris Hemsworth, Chris Pine, etc. 
     * By default, TMDB usually sorts these by relevance/popularity, but you can explicitly ensure your UI maps the array and highlights the highest popularity score with a special "Top Result" badge to immediately draw the user's eye to the most likely candidate!
     */
    searchPerson(
        query: string,
        page: number = 1,
        language: string = 'en-US',
        includeAdult: boolean = false
    ): Observable<TmdbPaginatedResponseDto<TmdbPersonListItemDto>> {
        const params = new HttpParams()
            .set('query', query)
            .set('page', page.toString())
            .set('language', language)
            .set('include_adult', includeAdult.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbPersonListItemDto>>('/search/person', { params });
    }

    /**
     * Search for TV shows by their original, translated and also known as names.
     * * @productContext
     * - Scenario 173 (The "Nostalgia Filter"): Leverage the `firstAirDateYear` parameter in an advanced search 
     * UI. If a user remembers a childhood show from the 90s, they can filter by year to skip modern reboots 
     * and find exactly what they are looking for.
     * -   **The Problem:** A user is hit with a wave of nostalgia and wants to rewatch a specific childhood cartoon called "Batman". However, searching "Batman" returns 15 different animated and live-action shows across 6 decades.
    
     -   **The Feature:** By leveraging the `first_air_date_year` parameter, CINESCOPE offers a "Decade Slider" in the advanced search UI. The user types "Batman" and slides the filter to the 1990s. The app strictly filters the results, instantly surfacing the legendary 1992 _Batman: The Animated Series_ at the top of the list without the clutter of modern reboots.
     * * @param query The text query to search for (Required).
     * @param page The page number to fetch (defaults to 1).
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param includeAdult Choose whether to include adult content in the results (defaults to false).
     * @param firstAirDateYear Search only the first air date. Valid values are: 1000..9999.
     * @param year Search the first air date and all episode air dates. Valid values are: 1000..9999.
     * 
     * Pro-Tip for CINESCOPE
Pay close attention to the difference between first_air_date_year and year in this endpoint:

     * first_air_date_year: Strictly looks at when the pilot episode aired. Great for finding when a show started.
     * 
     * year: Looks at the air date of any episode. If you search year: 2013 for "Breaking Bad", it will return it 
     * because episodes were airing that year, even though the show started in 2008.
     * 
     * If you implement the "Nostalgia Filter" scenario, first_air_date_year is almost always the parameter you want 
     * to use to ensure accurate decade filtering!
     */
    searchTvShows(
        query: string,
        page: number = 1,
        language: string = 'en-US',
        includeAdult: boolean = false,
        firstAirDateYear?: number,
        year?: number
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        let params = new HttpParams()
            .set('query', query)
            .set('page', page.toString())
            .set('language', language)
            .set('include_adult', includeAdult.toString());

        if (firstAirDateYear) {
            params = params.set('first_air_date_year', firstAirDateYear.toString());
        }
        if (year) {
            params = params.set('year', year.toString());
        }

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>('/search/tv', { params });
    }
}