import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseMediaService } from './base-media.service';
import { TmdbTvSeasonAggregateCreditsResponseDto } from '../dtos/tv-seasons/tv-season-aggregate-credits.dto';
import { TmdbTvSeasonChangesResponseDto } from '../dtos/tv-seasons/tv-season-changes.dto';
import { TmdbTvSeasonCreditsResponseDto } from '../dtos/tv-seasons/tv-season-credits.dto';
import { TmdbTvSeasonDetailDto } from '../dtos/tv-seasons/tv-season-detail.dto';
import { TmdbTvSeasonExternalIdsDto } from '../dtos/tv-seasons/tv-season-external-ids.dto';
import { TmdbTvSeasonImagesResponseDto } from '../dtos/tv-seasons/tv-season-images.dto';
import { TmdbTvSeasonTranslationsResponseDto } from '../dtos/tv-seasons/tv-season-translations.dto';
import { TmdbTvSeasonVideosResponseDto } from '../dtos/tv-seasons/tv-season-videos.dto';
import { TmdbTvSeasonWatchProvidersResponseDto } from '../dtos/tv-seasons/tv-season-watch-providers.dto';


@Injectable({ providedIn: 'root' })
export class TmdbTvSeasonsService extends BaseMediaService {
    /**
     * Query the details of a specific TV season.
     * * @productContext
     * - Scenario 204 (The "Binge Checklist" UI): Use the `episodes` array to build a granular checklist 
     * where users can view synopses, check runtimes, and track their watched status for a specific season.
     * 
     * The Problem: A user is halfway through Season 4 of The Sopranos. They know the show details, but they need a granular checklist of episodes for just this season so they can see which ones they have already watched and what the plot of the next episode is.

     * The Feature: "The Season Hub." CINESCOPE uses the TV Seasons Details endpoint to render a beautiful, scrollable list of all 13 episodes in the season. Each episode card displays the still_path thumbnail, the overview, and the runtime. If the user marks an episode as watched, a green checkmark appears, creating a deeply satisfying sense of progression.
     * 
     * * @param seriesId The TMDB TV Show ID.
     * @param seasonNumber The sequential number of the season (e.g., 1 for Season 1).
     * @param appendToResponse Comma-separated list of additional endpoints to append (e.g., 'credits,images').
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for CINESCOPE
     * If you look closely at the episodes array in the response, you'll see a field called episode_type (which can be "standard", "finale", etc.).
     * 
     * You can use this exact string to dynamically style your UI! If episode.episode_type === 'finale', you might render a special gold border around the episode card or add a "Season Finale" badge to hype the user up for the big conclusion!
     */
    getTvSeasonDetails(
        seriesId: number,
        seasonNumber: number,
        appendToResponse?: string,
        language?: string
    ): Observable<TmdbTvSeasonDetailDto> {
        let params = this.buildParams({ language, appendToResponse });

        if (appendToResponse) {
            params = params.set('append_to_response', appendToResponse);
        }

        return this.http.get<TmdbTvSeasonDetailDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}`, { params });
    }

    /**
     * Get the aggregate credits (cast and crew) across all episodes of a specific season.
     * * @productContext
     * - Scenario 205 (The "Season MVP" Tracker): Use this to see exactly how many episodes a specific guest star 
     * or director contributed to within a single season, highlighting the standout talent for that specific year.
     * The Feature: A fan is looking at Season 4 of Dexter and wants to know which director handled the most episodes, or how many episodes the "Trinity Killer" (John Lithgow) appeared in. CINESCOPE uses the Season Aggregate Credits to roll up the roles and jobs specifically for this season, proving Lithgow was the true MVP of Season 4.
     * * @param seriesId The TMDB TV Show ID.
     * @param seasonNumber The sequential number of the season.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for getTvSeasonAggregateCredits
        Sort by total_episode_count! When a season has 24 episodes (like a classic network sitcom), the raw array from TMDB might be messy. Always sort the cast array by total_episode_count in descending order on your frontend. This guarantees that the core stars of the season stay pinned to the top of your UI, naturally pushing the one-off "Monster of the Week" guest stars down to the bottom.
     */
    getTvSeasonAggregateCredits(
        seriesId: number,
        seasonNumber: number,
        language?: string
    ): Observable<TmdbTvSeasonAggregateCreditsResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbTvSeasonAggregateCreditsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}/aggregate_credits`, { params });
    }

    /**
     * Get the core credits (main cast and crew) for a specific TV season.
     * * @productContext
     * - Scenario 207 (The "Core Roster" Overlay): Use this standard credits list to cleanly display the primary 
     * billed cast for a season without bloating the UI with every single extra or minor guest star.
     * The Feature: If a user pauses Episode 1 of a new season, they just want to see the main billed cast for that season, not every single background extra who speaks one line in episode 10. CINESCOPE uses the standard Season Credits to cleanly display the core, high-level roster for the current season.
     * * @param seriesId The TMDB TV Show ID.
     * @param seasonNumber The sequential number of the season.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for getTvSeasonCredits
       Cache this aggressively.
       Unlike the top-level Series credits (which change every year as new seasons air), a specific Season's credits are essentially frozen in time once the season finishes airing. If a user is looking at Season 1 of The Sopranos, those credits haven't changed since 1999. Cache this response heavily in your Angular application state (or via an HTTP Interceptor) to save massive amounts of network bandwidth!
     */
    getTvSeasonCredits(
        seriesId: number,
        seasonNumber: number,
        language?: string
    ): Observable<TmdbTvSeasonCreditsResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbTvSeasonCreditsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}/credits`, { params });
    }

    /**
     * Get the recent changes for a specific TV season.
     * Note: This requires the unique TMDB Season ID, NOT the Series ID and Season Number!
     * * @productContext
     * - Scenario 206 (The "Release Radar"): Track this endpoint in a background cron job to alert users 
     * the exact moment a highly anticipated upcoming season gets an official `air_date` added to the database.
     * The Feature: A highly anticipated Season 2 of Severance is in production, but there is no release date yet. CINESCOPE tracks the Season Changes endpoint in the background. The moment a TMDB moderator adds an air_date to the season, CINESCOPE sends a push notification to eager fans!
     * * @param seasonId The unique TMDB Season ID (e.g., 3624).
     * @param startDate Optional start date for the query (Format: YYYY-MM-DD).
     * @param endDate Optional end date for the query (Format: YYYY-MM-DD).
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for getTvSeasonChanges
            Watch your ID types!
        This is the most common trap developers fall into. Notice that this is the only season endpoint that requires the actual TMDB seasonId (e.g., 3624) instead of the seriesId and seasonNumber. You cannot guess this ID. You must first fetch the TV Show Details or Season Details to extract the _id or id property, and then pass it into this changes endpoint.
     */
    getTvSeasonChanges(
        seasonId: number,
        startDate?: string,
        endDate?: string,
        page?: number
    ): Observable<TmdbTvSeasonChangesResponseDto> {
        let params = this.buildParams({ page });

        if (startDate) params = params.set('start_date', startDate);
        if (endDate) params = params.set('end_date', endDate);

        return this.http.get<TmdbTvSeasonChangesResponseDto>(`${this.apiPrefix}/tv/season/${seasonId}/changes`, { params });
    }

    /**
     * Get the external database IDs for a specific TV season.
     * * @productContext
     * Scenario 208: The "Spoiler-Free Wiki Dive" (External IDs): * Feature: If a user clicks an IMDb link on the main TV page, they might see spoilers for the final season. By using the Season External IDs, CINESCOPE deep-links the user directly to the IMDb page specifically for Season 2, protecting them from future spoilers.
     * databases like TheTVDB directly on the season page, preventing them from seeing Series Finale spoilers.
     * 
     * Pro-Tip for getTvSeasonExternalIds
        TheTVDB is your ultimate fallback.
        While TMDB is incredible, TheTVDB is a legacy database specifically built for hardcore television fans. If you ever find that a season is missing metadata, use the tvdb_id returned from this endpoint to hit TheTVDB's API as a silent background fallback. Your users will never know they are looking at data merged from two different global databases!
     */
    getTvSeasonExternalIds(seriesId: number, seasonNumber: number): Observable<TmdbTvSeasonExternalIdsDto> {
        return this.http.get<TmdbTvSeasonExternalIdsDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}/external_ids`);
    }

    /**
     * Get the poster images for a specific TV season.
     * * @productContext
     * Scenario 209: The "Seasonal Collector" (Images): * Feature: Many shows (like American Horror Story) have wildly different themes and artwork for each season. CINESCOPE uses the Season Images endpoint to let users pick their favorite official poster from the posters array to customize their personal watch-history library.
     * 
     * Pro-Tip for getTvSeasonImages
        Seasons only have Posters!
        If you look closely at the DTO we built, the Images endpoint for seasons only returns a posters array. TV Seasons do not have backdrops or logos—those belong exclusively to the parent TV Series. If you are building a Season UI, you must use the parent TV Show's backdrop for your background wallpaper, and the Season's poster for the foreground thumbnail. (And don't forget include_image_language: 'en,null' so you don't miss textless art!)
     */
    getTvSeasonImages(
        seriesId: number,
        seasonNumber: number,
        language?: string
    ): Observable<TmdbTvSeasonImagesResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbTvSeasonImagesResponseDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}/images`, { params });
    }

    /**
     * Get the translations for a specific TV season.
     * * @productContext
     * Scenario 210: The "Global Synopsis Fallback" (Translations): * Feature: Sometimes obscure international shows are missing English overviews for later seasons. CINESCOPE hits the Season Translations endpoint. If the English overview is empty, it elegantly falls back to a translated Spanish or French synopsis so the page never looks broken.
     * 
     * Pro-Tip for getTvSeasonTranslations
        The "Silent Swap" with append_to_response.
        Instead of making a separate API call when a user clicks a language toggle, append 'translations' to your initial getTvSeasonDetails call. Load the English overview by default, but keep the translations array hidden in memory. If a user clicks "Spanish", instantly swap the overview variable in your Angular component. The UI will update in 0.001 seconds without a single loading spinner, making your app feel magical.
     */
    getTvSeasonTranslations(seriesId: number, seasonNumber: number): Observable<TmdbTvSeasonTranslationsResponseDto> {
        return this.http.get<TmdbTvSeasonTranslationsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}/translations`);
    }

    /**
     * Get the videos (trailers, teasers, recaps) for a specific TV season.
     * * @productContext
     * Scenario 211: The "Season Recap" Auto-Play (Videos): * Feature: A user hasn't watched Stranger Things in two years and is about to start Season 4. CINESCOPE checks the Season Videos array for the previous season (Season 3), finds a video with the type "Recap" or "Featurette", and prompts the user: "Need a refresher? Watch the Season 3 Recap before starting."
     * 
     * Pro-Tip for getTvSeasonVideos
        Filter by name as well as type.
        A massive trap with season videos is that TMDB contributors sometimes mislabel things. You might filter for type === 'Trailer', but end up displaying a teaser for Episode 2 instead of the actual Season Trailer. To be safe, filter for type === 'Trailer' AND check if the name property contains the word "Season" to guarantee you are showing the macro-trailer for the whole year.
     */
    getTvSeasonVideos(
        seriesId: number,
        seasonNumber: number,
        language?: string,
        includeVideoLanguage?: string
    ): Observable<TmdbTvSeasonVideosResponseDto> {
        const params = this.buildParams({ language, includeVideoLanguage });
        return this.http.get<TmdbTvSeasonVideosResponseDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}/videos`, { params });
    }

    /**
     * Get the streaming, buying, and renting providers for a specific TV season.
     * * @productContext
     * Scenario 212: The "Fragmented Rights Resolver" (Watch Providers): * Feature: Streaming rights are notoriously messy. Season 1 of a show might be on Netflix, while Season 2 requires a premium Hulu add-on. By fetching the Season Watch Providers, CINESCOPE accurately tells the user exactly where the specific season they are on is streaming, preventing subscription frustration.
     * 
     * Pro-Tip for getTvSeasonWatchProviders
        The TMDB Link Fallback.
        The link property returned inside the country object (e.g., results['US'].link) is actually a web URL hosted by TMDB (powered by JustWatch). If you cannot figure out how to natively deep-link a user directly into the Netflix or Hulu mobile app, you can safely open this link string in an in-app WebView. It provides a beautiful, pre-built landing page showing exactly where to buy or stream the season.
     */
    getTvSeasonWatchProviders(seriesId: number, seasonNumber: number): Observable<TmdbTvSeasonWatchProvidersResponseDto> {
        return this.http.get<TmdbTvSeasonWatchProvidersResponseDto>(`${this.apiPrefix}/tv/${seriesId}/season/${seasonNumber}/watch/providers`);
    }
}