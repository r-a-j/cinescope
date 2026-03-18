import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseMediaService } from './base-media.service';
import { TmdbPaginatedResponseDto } from '../dtos/common/paginated-response.dto';
import { TmdbPersonListItemDto } from '../dtos/find/find-results.dto';
import { TmdbPersonChangesResponseDto } from '../dtos/people/person-changes.dto';
import { TmdbPersonCombinedCreditsResponseDto } from '../dtos/people/person-combined-credits.dto';
import { TmdbPersonDetailDto } from '../dtos/people/person-detail.dto';
import { TmdbPersonExternalIdsDto } from '../dtos/people/person-external-ids.dto';
import { TmdbPersonImagesResponseDto } from '../dtos/people/person-images.dto';
import { TmdbPersonMovieCreditsResponseDto } from '../dtos/people/person-movie-credits.dto';
import { TmdbPersonTranslationsResponseDto } from '../dtos/people/person-translations.dto';
import { TmdbPersonTvCreditsResponseDto } from '../dtos/people/person-tv-credits.dto';

@Injectable({ providedIn: 'root' })
export class TmdbPeopleService extends BaseMediaService {
    /**
     * Get a list of people ordered by popularity.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * This is a brilliant move. Giving "People" their own dedicated section in CINESCOPE is exactly what will power Scenario 15: The "Actor Marathon" and Scenario 25: The "Hey, It's That Guy!" from your product roadmap.
     * Users don't just follow genres; they follow creators and stars. The Popular People endpoint gives you an ever-updating list of who is currently trending in Hollywood (and globally), which is perfect for a "Trending Stars" carousel on your home screen.
     * 
     * Pro-Tip for CINESCOPE
     * The known_for array included in this response is a massive UX shortcut.
     * If you build a "Trending Actors" page, you don't just have to show the actor's headshot. 
     * Because TMDB pre-loads their top 3 most famous movies/shows directly into this response, 
     * you can instantly render a beautiful UI card that says:
     * "Ana de Armas - Known for: Knives Out, Blade Runner 2049, War Dogs" without having to make a second API call to fetch their filmography!
     */
    getPopularPeople(
        language = 'en-US',
        page = 1
    ): Observable<TmdbPaginatedResponseDto<TmdbPersonListItemDto>> {
        const params = this.buildParams({ language, page });

        return this.http.get<TmdbPaginatedResponseDto<TmdbPersonListItemDto>>(`${this.apiPrefix}/person/popular`, { params });
    }

    /**
     * Get the top level details of a person (actor, director, crew).
     * * @productContext
     * - Scenario 15 (The "Actor Marathon"): Use `append_to_response='movie_credits'` to get their entire 
     * filmography in one call and generate a gamified "Completionist Tracker" progress bar.
     * - Scenario 77 (The "Hometown Hero" Feed): Use `place_of_birth` to build localized "Actors from your area" widgets.
     * The Problem: Users love discovering that a famous Hollywood actor actually grew up in their home state or country, but there is no easy way to filter streaming apps by an actor's origin.
     * The Feature: By leveraging the place_of_birth field, CINESCOPE can create a dynamic, localized "Hometown Heroes" carousel. If the user's profile is set to Germany, the app surfaces a curated list of movies starring Michael Fassbender, Diane Kruger, or Christoph Waltz.
     * - Scenario 78 (The "Birthday Tribute"): Use `birthday` and `deathday` to trigger "In Memoriam" 
     * The Problem: Cinephiles love celebrating their favorite actors, but rarely know when their birthdays are.
     * The Feature: Using the birthday and deathday fields, CINESCOPE can send a tailored push notification: "Today is Tom Hanks' birthday! Celebrate by watching one of his classics." Or, it can generate an "In Memoriam" watchlist on the anniversary of an iconic actor's passing.
     * or "Birthday Celebration" automated watchlists.
     * * @param personId The TMDB Person ID (e.g., 31 for Tom Hanks).
     * @param appendToResponse Comma separated list of endpoints within this namespace (e.g., 'movie_credits,images').
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     */
    getPersonDetails(
        personId: number,
        appendToResponse?: string,
        language = 'en-US'
    ): Observable<TmdbPersonDetailDto> {
        let params = this.buildParams({ language });

        if (appendToResponse) {
            params = params.set('append_to_response', appendToResponse);
        }

        return this.http.get<TmdbPersonDetailDto>(`${this.apiPrefix}/person/${personId}`, { params });
    }

    /**
     * Get the recent changes for a person. By default only the last 24 hours are returned.
     * * @productContext
     * - Scenario 79 (The "Superfan Newsfeed"): Run this in the background for a user's favorite actors to notify them of new profile images or bio updates.
     * The Problem: Hardcore fans want to know the second something changes about their favorite actor's public profile, but checking Wikipedia manually is tedious.
     * The Feature: By tracking the Changes endpoint in a background cron-job for "Favorited" actors, CINESCOPE can send a push notification: "A new biography or profile image was just added for Ana de Armas!"
     * - Scenario 80 (The "Localization Bounty"): Track changes to the 'translations' key to gamify community-driven data updates.
     * The Problem: CINESCOPE wants to encourage non-English users to help translate missing actor data on TMDB, improving the app's data quality for everyone.
     * The Feature: The app uses this endpoint to detect when an actor's translations key changes. It can gamify this by showing users a "Recent Community Edits" feed, prompting them to contribute to missing translations in their native language for a special profile badge.
     * * @param personId The TMDB Person ID.
     * @param startDate Optional start date for the query (Format: YYYY-MM-DD). Query up to 14 days in a single call.
     * @param endDate Optional end date for the query (Format: YYYY-MM-DD).
     * @param page The page number to fetch (defaults to 1).
     */
    getPersonChanges(
        personId: number,
        startDate?: string,
        endDate?: string,
        page = 1
    ): Observable<TmdbPersonChangesResponseDto> {
        let params = this.buildParams({ page });

        if (startDate) params = params.set('start_date', startDate);
        if (endDate) params = params.set('end_date', endDate);

        return this.http.get<TmdbPersonChangesResponseDto>(`${this.apiPrefix}/person/${personId}/changes`, { params });
    }

    /**
     * Get the combined movie and TV credits that belong to a person.
     * * @productContext
     * - Scenario 15 (The "Actor Marathon"): Use this endpoint's `cast` array to power "The Completionist Tracker." Map through the array and check it against the user's watch history to generate a gamified progress bar (e.g., "You are 30% of the way through the Nicolas Cage collection").
     * - Scenario 25 (The "Hey, It's That Guy!"): When a user taps an obscure character actor on a movie page, use this endpoint to instantly list all the other random TV shows and movies they have appeared in.
     * * @param personId The TMDB Person ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for CINESCOPE
     * Because this returns every credit an actor has ever had, you might find that legendary actors (like Tom Hanks or Samuel L. Jackson) return massive JSON payloads with hundreds of items.
     * When building the UI for the actor's profile page, it's best practice to:
     * Fetch this combined credits endpoint.
     * Sort the cast array in memory by popularity (descending) or release_date (newest first).
     * Slice the array to only show the top 10 results in a horizontal "Known For" carousel.
     * Provide a "See Full Filmography" button that routes to a dedicated list page for the hardcore cinephiles wanting to do the "Actor Marathon".
     */
    getPersonCombinedCredits(personId: number, language = 'en-US'): Observable<TmdbPersonCombinedCreditsResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbPersonCombinedCreditsResponseDto>(`${this.apiPrefix}/person/${personId}/combined_credits`, { params });
    }

    /**
     * Get the external social media and database IDs that belong to a person.
     * * @productContext
     * - Scenario 81 (The "Stan" Deep-Link Hub): Map these IDs (tiktok_id, instagram_id) to native 
     * mobile deep-links so users can seamlessly follow actors on social media directly from their CINESCOPE profile.
     * - The Problem: A user discovers a hilarious supporting actor in a comedy movie and wants to follow them on Instagram or TikTok, but spelling their name correctly in the search bar of another app is annoying.
     * - The Feature: On the actor's CINESCOPE profile, display clean, minimalist icons for Instagram, TikTok, and Twitter. When tapped, CINESCOPE uses Deep Linking (via these External IDs) to instantly open the native social media app directly to that actor's verified profile, creating a frictionless bridge between cinema and social media.
     * * @param personId The TMDB Person ID.
     * 
     * Pro-Tip for CINESCOPE
     * If you are using the performance-boosting append_to_response parameter we built into the getPersonDetails method, you can grab this social media data immediately when loading the actor's page!
     * For example:
     * this.peopleService.getPersonDetails(31, 'external_ids,combined_credits')
     * This single API call will give you Tom Hanks' biography, his entire filmography, and his Twitter handle all at once, allowing your UI to render instantly without cascading network delays.
     */
    getPersonExternalIds(personId: number): Observable<TmdbPersonExternalIdsDto> {
        return this.http.get<TmdbPersonExternalIdsDto>(`${this.apiPrefix}/person/${personId}/external_ids`);
    }

    /**
     * Get the profile images that belong to a person.
     * * @productContext
     * - Scenario 82 (The "Eras Tour" Visual Timeline): Map through the `profiles` array to create a swipeable "Story" UI showing the actor's visual evolution over time.
     * - The Problem: When users look up legendary actors (like Brad Pitt or Meryl Streep), a single static headshot doesn't capture their iconic transformations over the decades.
     * - The Feature: Because TMDB returns an array of profile images sorted by popularity (which often spans their entire career), CINESCOPE can implement an Instagram-style "Story" UI on the actor's profile page. Users can tap the actor's headshot to swipe through their visual evolution from the 1990s to today.
     * - Scenario 55 (Custom Poster Vault - Actor Edition): Let premium users pick their favorite iconic headshot from this array to represent the actor in their personal "Favorite Stars" grid.
     * - The Problem: Instagram is too curated. You want to show your friends your actual, messy Friday night.
     * - The Premium Feature: "The Living Room Check-In." A spontaneous notification goes off: "What's the vibe?" You have 2 minutes to snap a dual-camera photo of your TV screen and your current snacks/setup, sharing the raw reality of your watch party.  
     * * @param personId The TMDB Person ID.
     * 
     * Pro-Tip for CINESCOPE
     * If you look closely at the JSON response, some of the older or more obscure images have low vote_average scores or very few vote_count tallies.
     * When rendering these images in the app, you can use a simple TypeScript filter to ensure you only display high-quality headshots:
     * 
     * Only show profile images that the community agrees are actually good representations of the actor
     * const highQualityProfiles = response.profiles.filter(image => image.vote_count > 10);    
     * 
     * And remember, you can append 'images' to your getPersonDetails call to get this array instantly alongside the biography!
     */
    getPersonImages(personId: number): Observable<TmdbPersonImagesResponseDto> {
        return this.http.get<TmdbPersonImagesResponseDto>(`${this.apiPrefix}/person/${personId}/images`);
    }

    /**
     * Get the newest created person in the TMDB database.
     * Note: This is a live response and will continuously change.
     * * * @productContext
     * - Scenario 83 (The "Cinephile Pulse" Ticker): Use this in a hidden "Community" tab to display a live, 
     * updating feed of the newest obscure indie actors and crew members being added to the database worldwide.
     * 
     * The Problem: Hardcore film nerds and TMDB contributors love seeing the database grow in real-time, but most apps only focus on mainstream A-listers.
     * The Feature: A hidden "Easter Egg" live ticker in the app's settings or "Community" tab that continuously fetches the latest movies and people added to the global database. It highlights the obscure indie directors, background actors, and international talent being cataloged globally by the second.
     */
    getLatestPerson(): Observable<TmdbPersonDetailDto> {
        return this.http.get<TmdbPersonDetailDto>(`${this.apiPrefix}/person/latest`);
    }

    /**
     * Get the movie credits for a person.
     * * @productContext
     * - Scenario 84 (The "Binge vs. Blockbuster" Tabs): Use this to populate a dedicated "Movies Only" tab on the actor's profile for users who only have 2 hours to spare.
     * - The Problem: A user loves an actor and wants to watch them tonight, but they only have 2 hours. A combined filmography feed clutters their screen with 8-season TV shows they don't have time to start.
     * - The Feature: On the actor's profile, create distinct UI tabs for "Movies" and "TV Shows". Use the `Movie Credits` endpoint to feed a "Watch Tonight" carousel, and the `TV Credits` endpoint to feed a "Start a Binge" carousel.
     * * @param personId The TMDB Person ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * Pro-Tip for CINESCOPE
     * If you look closely at the crew arrays for these endpoints, you will notice fields for department and job (e.g., department: "Directing", job: "Director").
     * This is incredibly useful if a user is looking at someone like Jon Favreau or Jordan Peele, who are famous for both acting and directing.
     * You can filter their profile dynamically:
     * const directingCredits = response.crew.filter(credit => credit.job === 'Director');
     * This allows you to render a distinct "Directed By" carousel, separate from their "Acted In" carousel!
     */
    getPersonMovieCredits(personId: number, language = 'en-US'): Observable<TmdbPersonMovieCreditsResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbPersonMovieCreditsResponseDto>(`${this.apiPrefix}/person/${personId}/movie_credits`, { params });
    }

    /**
     * Get the TV credits that belong to a person.
     * * @productContext
     * - Scenario 85 (The "Cameo Catcher"): Filter the `cast` array for `episode_count <= 2` to create a fun "Iconic Guest Appearances" UI row.
     * - The Problem: Famous actors often do hilarious, one-off guest appearances on sitcoms (e.g., Brad Pitt on _Friends_), but these get buried in their massive filmographies.
     * - The Feature: Using the `TV Credits` endpoint, CINESCOPE filters the `cast` array for items where `episode_count <= 2`. It then creates a dedicated UI row called "Iconic Guest Appearances," allowing users to jump straight into those specific, legendary single episodes.
     * * @param personId The TMDB Person ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * Pro-Tip for CINESCOPE
     * If you look closely at the crew arrays for these endpoints, you will notice fields for department and job (e.g., department: "Directing", job: "Director").
     * This is incredibly useful if a user is looking at someone like Jon Favreau or Jordan Peele, who are famous for both acting and directing.
     * You can filter their profile dynamically:
     * const directingCredits = response.crew.filter(credit => credit.job === 'Director');
     * This allows you to render a distinct "Directed By" carousel, separate from their "Acted In" carousel!
     */
    getPersonTvCredits(personId: number, language = 'en-US'): Observable<TmdbPersonTvCreditsResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbPersonTvCreditsResponseDto>(`${this.apiPrefix}/person/${personId}/tv_credits`, { params });
    }

    /**
     * Get the translations that belong to a person.
     * * @productContext
     * - Scenario 86 (The "Global Star" Seamless Fallback): Use this array to intelligently fall back to English or the actor's native language if a biography hasn't been translated into the user's localized device language yet.
     * The Problem: CINESCOPE is a global app. A user in Germany is looking at a breakout star from a Korean indie film. The TMDB database might only have their biography written in Korean and English. If the app strictly requests German, it will return a blank screen.
     * The Feature: "Smart Bio-Fallback." The app quickly checks the translations array. If German isn't there, it defaults to English. If English isn't there, it defaults to the actor's native language and provides an embedded "Translate via Google" button so the user never hits a dead end.
     * * @param personId The TMDB Person ID.
     * 
     * Pro-Tip for CINESCOPE
     * Because you mentioned earlier that CINESCOPE will have a global reach, the name property inside data is a huge UX detail.
     * If an international user is searching for Tom Hanks, but their keyboard is set to Russian or Mandarin, they will type "Том Хэнкс" or "汤姆·汉克斯". By utilizing these translations in your app's internal search logic or display headers, you instantly make non-English speakers feel like the app was built natively for them, rather than just being a translated American app.
     */
    getPersonTranslations(personId: number): Observable<TmdbPersonTranslationsResponseDto> {
        return this.http.get<TmdbPersonTranslationsResponseDto>(`${this.apiPrefix}/person/${personId}/translations`);
    }
}