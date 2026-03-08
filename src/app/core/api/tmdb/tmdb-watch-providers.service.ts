import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    TmdbWatchRegionsResponseDto,
    TmdbGlobalWatchProvidersResponseDto
} from '../../models/tmdb/watch-providers/watch-provider.dto';

@Injectable({ providedIn: 'root' })
export class TmdbWatchProvidersService {
    constructor(private http: HttpClient) { }

    /*
        The Watch Providers Masterclass: Enterprise Pro-Tips
        Taking this slowly reveals several massive architectural gotchas you must be aware of:

        THE LEGAL REQUIREMENT (JustWatch Attribution): As the documentation explicitly states, this data is provided by JustWatch. If you use this API, you are legally required to display the JustWatch logo and attribute them. Failure to do so can result in TMDB revoking your API key. Make sure your UI components that display these streaming logos include a small "Powered by JustWatch" footer!

        The "Global List" Trap:
            If you do not pass a watch_region to getMovieProviders or getTvProviders, TMDB returns every provider on the planet. This array will be massive and largely useless for a user interface. Always attempt to pass the watch_region parameter (e.g., watch_region=US) based on the user's selected country from the Available Regions list so you only download the ~50 providers relevant to them.

        Dynamic Sorting via display_priorities:
            If you fetch the global list without a region filter, do not just sort by the base display_priority. You must write a JavaScript sort function that looks up the user's country code inside the display_priorities object:

            TypeScript
            providers.sort((a, b) => {
                const aRank = a.display_priorities['US'] ?? 999; 
                const bRank = b.display_priorities['US'] ?? 999;
                return aRank - bRank; 
            });
            This guarantees that local heavyweights show up first, rather than foreign apps the user has never heard of.

        The Discover API Synergy:
            The true power of this namespace isn't just showing logos. The provider_id (e.g., Netflix = 8) is the exact integer you must pass to the Discover API using the with_watch_providers=8 query parameter. This is how you build a "Show me only Horror movies currently on Netflix" feature.
    */

    /**
     * Get the list of countries that have valid watch provider (OTT/streaming) data.
     * * @productContext Scenario 135 (The "Global Passport" Onboarding): Use this to populate a country-picker 
     * dropdown so you can accurately filter streaming data based on the user's physical location.
     * Scenario 221: The "Global Passport" Onboarding (Available Regions):
     * Problem: Streaming availability is geo-locked. Recommending a Hulu show to a user in Germany is a frustrating user experience because Hulu doesn't exist there.
     * Feature: During app onboarding, CINESCOPE uses the Available Regions endpoint to populate a "Select Your Country" dropdown. This locks in their iso_3166_1 code, ensuring the app only ever shows them valid streaming data for their physical location.
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     */
    getAvailableRegions(language: string = 'en-US'): Observable<TmdbWatchRegionsResponseDto> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbWatchRegionsResponseDto>('/watch/providers/regions', { params });
    }

    /**
     * Get the list of all available streaming providers for Movies.
     * * @productContext Scenario 136 (The "My Subscriptions" Filter): Render these providers in a settings menu 
     * so users can select the services they pay for, allowing you to feed those IDs into the Discover endpoint.
     * Scenario 222: The "My Subscriptions" Filter (Movie Providers):
     * Problem: Users are tired of paying for 8 different services. They only want to see movies available on the 3 services they actually pay for.
     * Feature: On a dedicated "My Subscriptions" settings page, CINESCOPE fetches the Movie Providers list, filtered by the user's country. It displays a grid of logos (Netflix, Max, Apple TV). The user clicks the ones they own. CINESCOPE saves these IDs and injects them into the with_watch_providers parameter of all future Discover API calls!
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param watchRegion Optional ISO-3166-1 country code to filter the list to a specific country (e.g., 'US').
     */
    getMovieProviders(
        language: string = 'en-US',
        watchRegion?: string
    ): Observable<TmdbGlobalWatchProvidersResponseDto> {
        let params = new HttpParams().set('language', language);
        if (watchRegion) params = params.set('watch_region', watchRegion);

        return this.http.get<TmdbGlobalWatchProvidersResponseDto>('/watch/providers/movie', { params });
    }

    /**
     * Get the list of all available streaming providers for TV Shows.
     * * @productContext Scenario 137 (The "Ecosystem" Toggle): Use this specifically when users are configuring 
     * their TV streaming habits, as TV networks (like AMC or HBO) often have different platform priorities than movies.
     * Scenario 223: The "Ecosystem" Toggle (TV Providers):
     * Problem: A user wants to browse exclusively for TV shows, but TV networks often have their own proprietary streaming apps (like Paramount+ or Peacock) that differ from movie hubs.
     * Feature: CINESCOPE fetches the TV Providers endpoint. Because TV streaming priority differs from movies, the app uses the display_priority field to rank the TV network logos perfectly in the UI, ensuring the most relevant local broadcasters appear first.
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param watchRegion Optional ISO-3166-1 country code to filter the list to a specific country (e.g., 'US').
     */
    getTvProviders(
        language: string = 'en-US',
        watchRegion?: string
    ): Observable<TmdbGlobalWatchProvidersResponseDto> {
        let params = new HttpParams().set('language', language);
        if (watchRegion) params = params.set('watch_region', watchRegion);

        return this.http.get<TmdbGlobalWatchProvidersResponseDto>('/watch/providers/tv', { params });
    }
}