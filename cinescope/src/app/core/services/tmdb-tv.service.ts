import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseMediaService } from './base-media.service';
import { TmdbCertificationResponseDto } from '../dtos/common/certification.dto';
import { TmdbPaginatedResponseDto } from '../dtos/common/paginated-response.dto';
import { TmdbReviewDto } from '../dtos/reviews/review.dto';
import { TmdbTvAggregateCreditsResponseDto } from '../dtos/tv/tv-aggregate-credits.dto';
import { TmdbTvAlternativeTitlesResponseDto } from '../dtos/tv/tv-alternative-titles.dto';
import { TmdbTvChangesResponseDto } from '../dtos/tv/tv-changes.dto';
import { TmdbTvContentRatingsResponseDto } from '../dtos/tv/tv-content-ratings.dto';
import { TmdbTvCreditsResponseDto } from '../dtos/tv/tv-credits.dto';
import { TmdbTvDetailDto } from '../dtos/tv/tv-detail.dto';
import { TmdbTvEpisodeGroupsResponseDto } from '../dtos/tv/tv-episode-groups.dto';
import { TmdbTvExternalIdsDto } from '../dtos/tv/tv-external-ids.dto';
import { TmdbTvImagesResponseDto } from '../dtos/tv/tv-images.dto';
import { TmdbTvKeywordsResponseDto } from '../dtos/tv/tv-keywords.dto';
import { TmdbTvListItemDto } from '../dtos/tv/tv-list-item.dto';
import { TmdbTvListResultDto } from '../dtos/tv/tv-list-result.dto';
import { TmdbTvScreenedTheatricallyResponseDto } from '../dtos/tv/tv-screened-theatrically.dto';
import { TmdbTvTranslationsResponseDto } from '../dtos/tv/tv-translations.dto';
import { TmdbTvVideosResponseDto } from '../dtos/tv/tv-videos.dto';
import { TmdbTvWatchProvidersResponseDto } from '../dtos/tv/tv-watch-providers.dto';

@Injectable({ providedIn: 'root' })
export class TmdbTvService extends BaseMediaService {
    /**
     * Get an up to date list of the officially supported TV show certifications on TMDB.
     */
    getTvCertifications(): Observable<TmdbCertificationResponseDto> {
        return this.http.get<TmdbCertificationResponseDto>('/certification/tv/list');
    }

    /**
     * Get a list of TV shows airing today.
     * * @productContext
     * - Scenario 181 (The "Prime Time" Widget): Use this endpoint to power a "Dropping Tonight" 
     * carousel. Always pass the user's local timezone to ensure "today" accurately reflects 
     * their geographical reality, preventing spoiler disasters!
     * -   **The Problem:** In the streaming era, users have lost track of the traditional "TV Guide." They often miss the premiere of a highly anticipated weekly episode (like _The Last of Us_ or _Succession_) and end up getting spoiled on Twitter the next morning.
    
     -   **The Feature:** A dynamic "Dropping Tonight" widget on the home screen. By passing the user's local `timezone` to the **Airing Today** endpoint, CINESCOPE guarantees it only shows episodes that are actually premiering _today_ in the user's specific region, ensuring they never miss a live premiere again.
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * @param timezone Optional timezone string (e.g., 'America/New_York') to accurately calculate "today".
     * 
     * Pro-Tip for CINESCOPE
     * The timezone parameter is the secret sauce here. If you don't pass a timezone, TMDB defaults to UTC.
     * If your user is in Los Angeles (America/New_York) and it is 10:00 PM on a Tuesday, UTC time is already 5:00 AM on Wednesday. Without the timezone parameter, the API will return shows airing on Wednesday, breaking the illusion of your "Dropping Tonight" widget!
     * You can easily grab the user's timezone dynamically in JavaScript/Angular before making the API call:
     * const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
     * this.tvService.getTvAiringToday('en-US', 1, userTimezone);
     */
    getTvAiringToday(
        language?: string,
        page?: number,
        timezone?: string
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        let params = this.buildParams({ language, page, timezone });

        if (timezone) {
            params = params.set('timezone', timezone);
        }

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/tv/airing_today`, { params });
    }

    /**
     * Get a list of TV shows that air in the next 7 days.
     * * @productContext
     * - Scenario 182 (The "Catch-Up Countdown"): Use this 7-day lookahead window to prompt users 
     * to finish catching up on their favorite weekly shows before the next episode airs and spoilers hit the internet.
     * 
     * -   **The Problem:** A user is 3 episodes behind on a popular weekly show. They don't realize the season finale is airing this coming Sunday, which means they are about to get hit with massive spoilers on Monday morning.
    
    -   **The Feature:** CINESCOPE uses the **On The Air** endpoint to build a "Your Week Ahead" UI. By cross-referencing this 7-day list with the user's watch history, the app can display a red warning badge: _"Warning: The next episode of The Last of Us drops in 4 days, and you are 2 episodes behind. Time to catch up!"
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * @param timezone Optional timezone string (e.g., 'America/New_York') to accurately calculate the next 7 days.
     * 
     * Pro-Tip for CINESCOPE
     * If you look at the documentation note, TMDB mentions that this endpoint is essentially just a pre-configured Discover API call behind the scenes (air_date.lte={max_date}&air_date.gte={min_date}).
     * If you ever find that this endpoint is returning too much "junk" data (like obscure reality TV shows or news broadcasts), you can actually abandon this endpoint and build your own custom "On The Air" call using the Discover TV endpoint. By doing that, you can pass &with_networks=49 (HBO) or &without_genres=10763 (News) to heavily curate the 7-day lookahead for your users!
     */
    getTvOnTheAir(
        language?: string,
        page?: number,
        timezone?: string
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        let params = this.buildParams({ language, page, timezone });

        if (timezone) {
            params = params.set('timezone', timezone);
        }

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/tv/on_the_air`, { params });
    }

    /**
     * Get a list of TV shows ordered by popularity.
     * * @productContext
     * - Scenario 183 (The "Safest Bet"): Use this endpoint to populate a "Global Phenomenons" row on the TV dashboard. 
     * When users have decision paralysis, surfacing universally popular shows provides a low-risk viewing choice.
     * 
     * -   **The Problem:** A user just finished a massive 5-season binge and is experiencing severe "decision paralysis" about what to watch next. They don't want to risk investing their time into a confusing or poorly received show.
    
     * -   **The Feature:** CINESCOPE uses the **Popular** endpoint to build a "Global Phenomenons" row right at the top of the TV dashboard. By showing them the absolute biggest hits worldwide, the app provides a low-friction, high-reward "safe bet" to cure their decision fatigue.
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     */
    getPopularTvShows(
        language?: string,
        page?: number
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        const params = this.buildParams({ language, page });

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/tv/popular`, { params });
    }

    /**
     * Get a list of TV shows ordered by rating.
     * * @productContext
     * - Scenario 184 (The "Prestige TV Vault"): Use this endpoint to build a "Hall of Fame" UI section, 
     * surfacing all-time critically acclaimed masterpieces that might be buried by newer, trendier content.
     * -   **The Problem:** Streaming algorithms heavily push whatever is brand new or currently trending, often burying absolute masterpieces that aired 10 or 20 years ago (like _The Wire_ or _The Sopranos_). Users who want guaranteed high-art television have to hunt for it.
    
     * -   **The Feature:** CINESCOPE uses the **Top Rated** endpoint to power a "Hall of Fame" section. This curates a timeless, prestige-only tier of television that ignores current pop culture trends and purely ranks shows by their all-time critical and audience acclaim.
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     */
    getTopRatedTvShows(
        language?: string,
        page?: number
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        const params = this.buildParams({ language, page });

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/tv/top_rated`, { params });
    }

    /**
     * Get the primary details of a TV show.
     * * @productContext
     * - Scenario 185 (The "Where Was I?" Status Bar): Use the `status`, `last_episode_to_air`, and `next_episode_to_air` objects to instantly tell the user if the show is still airing and exactly when the next episode drops.
     * 
     * -   **The Problem:** When users revisit a show they paused months ago, they often forget if they finished the latest season, or if a new season has started airing. They have to manually dig through the season list to check.
    
     * -   **The Feature:** "Instant Context." On the main TV show page, CINESCOPE uses the `status`, `last_episode_to_air`, and `next_episode_to_air` objects. If the show is currently airing, it prominently displays: _"Season 3, Episode 4 aired 2 days ago. Next episode airs Sunday."_ If the show is over, it displays a clean _"Status: Ended (8 Seasons)"_ banner right under the title.
     * * @param seriesId The TMDB TV Show ID (e.g., 1399 for Game of Thrones).
     * @param appendToResponse Comma separated list of endpoints within this namespace (e.g., 'credits,videos,images').
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for CINESCOPE
     * When rendering the "Seasons" list in your UI, be careful! The seasons array returned here almost always includes a "Season 0" (which is usually named "Specials").
     * If you are building a simple "Season 1, Season 2, Season 3" dropdown menu, you might want to filter out season_number: 0 so users aren't confused by random behind-the-scenes interviews or blooper reels appearing as the very first season!
     */
    getTvShowDetails(
        seriesId: number,
        appendToResponse?: string,
        language?: string
    ): Observable<TmdbTvDetailDto> {
        let params = this.buildParams({ language, appendToResponse });

        if (appendToResponse) {
            params = params.set('append_to_response', appendToResponse);
        }

        return this.http.get<TmdbTvDetailDto>(`${this.apiPrefix}/tv/${seriesId}`, { params });
    }

    /**
     * Get the aggregate credits (cast and crew) that have been added to a TV show across all episodes/seasons.
     * * @productContext
     * - Scenario 186 (The "True MVP" Tracker): Map through the `roles` and `jobs` arrays to build a robust UI that honors actors and crew members who performed multiple duties over the lifespan of a massive show.
     * 
     * -   **The Problem:** On massive, long-running shows like _The Simpsons_, _Doctor Who_, or _Saturday Night Live_, immensely talented actors might voice or play dozens of different characters over decades. A standard cast list just lists their name once, completely underselling their contribution.
     * -   **The Feature:** "The Multi-Role Highlight." By leveraging the `roles` array and the `total_episode_count` property, CINESCOPE's UI can explicitly showcase an actor's versatility. When a user clicks on Hank Azaria under _The Simpsons_, a beautiful accordion expands showing every single character he voiced, alongside exactly how many episodes that specific character appeared in.
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for CINESCOPE
     * Because this returns every single person who ever worked on the show, the payload for a show like Grey's Anatomy (which has hundreds of episodes) can be absolutely massive.
     * When rendering this in the UI, you should sort the arrays in memory by total_episode_count in descending order. This ensures that the core cast and crew who were there for the entire run of the show always appear at the top of your lists, pushing the one-off guest stars and daily crew down to the bottom where they belong!
     */
    getTvAggregateCredits(
        seriesId: number,
        language?: string
    ): Observable<TmdbTvAggregateCreditsResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbTvAggregateCreditsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/aggregate_credits`, { params });
    }

    /**
     * Get the alternative titles that have been added to a TV show.
     * * @productContext
     * - Scenario 187 (The "Expat Nostalgia" UI): Fetch this list on the TV Details page and cross-reference 
     * it with the user's native country code. Display a small "AKA: [Title]" badge under the main header 
     * so international users easily recognize heavily localized shows.
     * -   **The Problem:** A user who immigrated from Brazil to the US is looking at the English page for a famous telenovela, but they want to confirm it's exactly the one they remember watching with their grandmother under its original Brazilian broadcast name.
     * -   **The Feature:** "Also Known As (AKA) Tagging." On the TV Show Details page, CINESCOPE fetches the Alternative Titles. It filters the array to find the title matching the user's native `iso_3166_1` country code and places a neat little tag under the main English title: _(AKA: "A Guerra dos Tronos")_. This instantly reassures the user they have found the right show.
     * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
     * If you are using the append_to_response trick we built into getTvShowDetails earlier, you can actually fetch this at the exact same time as the main details!
     * Just call:
     * this.tvService.getTvShowDetails(1399, 'alternative_titles')
     * This prevents a secondary network request and ensures the page renders perfectly the first time.
     */
    getTvAlternativeTitles(seriesId: number): Observable<TmdbTvAlternativeTitlesResponseDto> {
        return this.http.get<TmdbTvAlternativeTitlesResponseDto>(`${this.apiPrefix}/tv/${seriesId}/alternative_titles`);
    }

    /**
     * Get the recent changes for a TV show.
     * * @productContext
     * - Scenario 188 (The "Superfan Spoiler Feed"): Run this in the background for highly anticipated shows. Look for changes where the `key` is 'season' or 'episode' to notify users of leaked episode titles or upcoming season poster drops before official announcements.
     * -   **The Problem:** Hardcore fandoms for shows like _Stranger Things_ or _Severance_ aggressively monitor the internet for leaks. They want to know the _second_ a new episode title is revealed or a new season poster drops, often days before official press releases.
     * -   **The Feature:** By silently tracking the **Changes** endpoint for a user's "Favorited" shows, CINESCOPE can look for updates under the `season` or `episode` keys. It then sends a push notification: _"Alert: A new episode title was just added to the TMDB database for Severance Season 2!"_ giving super-fans the cutting-edge information they crave.
     * * @param seriesId The TMDB TV Show ID.
     * @param startDate Optional start date for the query (Format: YYYY-MM-DD). Query up to 14 days in a single call.
     * @param endDate Optional end date for the query (Format: YYYY-MM-DD).
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for CINESCOPE
     * If you write a script to look through these changes, pay close attention to the value payload when the key is season or episode. TMDB will usually inject series_id and episode_id right into that value object.
     * You can extract that specific ID and immediately fire off a secondary request to the TV Episodes Details endpoint to see exactly what was just modified!
     */
    getTvChanges(
        seriesId: number,
        startDate?: string,
        endDate?: string,
        page?: number
    ): Observable<TmdbTvChangesResponseDto> {
        let params = this.buildParams({ page });

        if (startDate) params = params.set('start_date', startDate);
        if (endDate) params = params.set('end_date', endDate);

        return this.http.get<TmdbTvChangesResponseDto>(`${this.apiPrefix}/tv/${seriesId}/changes`, { params });
    }

    /**
     * Get the content ratings that have been added to a TV show.
     * * @productContext
     * - Scenario 189 (The "Parental Guardian" Badge): Cross-reference the `results` array with the user's 
     * local region code to display a highly visible, localized age rating badge (like TV-14 or 16) directly 
     * on the show's hero banner, ensuring a family-safe browsing experience.
     * -   **The Problem:** A parent is browsing for a new show to watch with their 12-year-old. They see a cool sci-fi poster, but they aren't sure if it has extreme violence or language. Googling the parental guidance for every single show creates massive friction.
     * -   **The Feature:** "Dynamic Age Badges." CINESCOPE fetches the **Content Ratings** array. It cross-references the `iso_3166_1` country code with the user's device region. It then displays a highly visible, color-coded badge right next to the show's title (e.g., a green "TV-PG" or a red "TV-MA"). If the user taps the badge, it expands to show the `descriptors` array (e.g., "Graphic Violence", "Strong Language").
     * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
     * - Just like Alternative Titles, this is another endpoint that fully supports append_to_response!
     * - Instead of making a separate API call for Content Ratings, you can fetch the core details, the cast, the alternative titles, AND the content ratings all in one single, lightning-fast request when the user opens the TV Show page:
     * - this.tvService.getTvShowDetails(1399, 'aggregate_credits,alternative_titles,content_ratings');
     * - This is the secret to making CINESCOPE feel as fast as Netflix or Apple TV.
     */
    getTvContentRatings(seriesId: number): Observable<TmdbTvContentRatingsResponseDto> {
        return this.http.get<TmdbTvContentRatingsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/content_ratings`);
    }

    /**
     * Get the latest season credits of a TV show.
     * Note: Use `getTvAggregateCredits` if you want the cast for the entire show's history.
     * * @productContext
     * - Scenario 190 (The "Who is the New Guy?" Overlay): Use this endpoint when the user wants to identify an actor in an ongoing show, as it filters out legacy actors from previous seasons and only surfaces the current active roster.
     * -   **The Problem:** Long-running shows like _Fargo_ or _The White Lotus_ introduce entirely new casts every season. If a user is watching Season 5 and pauses to see who an actor is, an `Aggregate` list will show them 500 actors from the past decade, making it impossible to find the current actor.
     * -   **The Feature:** "Current Roster X-Ray." By using this standard **Credits** endpoint, CINESCOPE guarantees it only fetches the active cast for the _current_ season. When the user pauses the TV, the app shows a highly relevant, condensed row of just the 10 actors actually appearing in the episodes they are watching right now.
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * ### Pro-Tip for CINESCOPE
     * **When to use `Credits` vs `Aggregate Credits`:**
     * -   **Use `Aggregate Credits`** on the main "TV Show Details" page (e.g., the _Game of Thrones_ landing page) so users can see everyone who ever contributed to the masterpiece.
     * -   **Use this `Credits` endpoint** (or the specific Season/Episode Credits endpoints we might build later) if your app has a "Smart Pause" feature that overlays actor info while a video is playing, so you don't overwhelm the UI with irrelevant actors!
     */
    getTvCredits(
        seriesId: number,
        language?: string
    ): Observable<TmdbTvCreditsResponseDto> {
        const params = this.buildParams({ language });
        return this.http.get<TmdbTvCreditsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/credits`, { params });
    }

    /**
     * Get the alternative episode groups that have been added to a TV show (e.g., DVD Order, Story Arcs).
     * * @productContext
     * - Scenario 105 (The "True Order" Toggle): Detect if a show has a "Story Arc" or "Chronological" group type. 
     * If it does, offer the user a toggle switch to completely reorganize the episode list away from the often-flawed original broadcast seasons.
     * -   **The Problem:** A user wants to watch _Star Wars: The Clone Wars_, but the episodes aired completely out of chronological order on TV. If they watch them straight through using a standard streaming app's "Season 1, Season 2" format, the timeline jumps back and forth confusingly.
    
     * -   **The Feature:** "The Arc Viewer." CINESCOPE hits the **Episode Groups** endpoint and detects that a "Chronological Order" or "Story Arc" group exists for the show. The app surfaces a toggle switch above the episode list: _"Sort by: Broadcast Season | Chronological Story Arc"_. The user flips the switch, and CINESCOPE instantly reorders the entire 7-season show into its perfectly curated narrative timeline.
     * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
     * - If you look at the id field in the response ("5b48b111c3a368307201c3de"), it is a string hash rather than a standard TMDB integer.
     * - When you want to actually fetch the episodes inside that specific group (which we will likely do later when we hit the TV Episode Groups namespace), you will pass that exact string ID to a different endpoint to get the fully re-ordered list of episodes!
     */
    getTvEpisodeGroups(seriesId: number): Observable<TmdbTvEpisodeGroupsResponseDto> {
        return this.http.get<TmdbTvEpisodeGroupsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/episode_groups`);
    }

    /**
     * Get the external social media and database IDs that belong to a TV show.
     * * @productContext
     * - Scenario 192 (The "Live-Tweet" & "Wiki Dive" Hub): Map these IDs to native mobile deep-links so users can 
     * seamlessly join official social media conversations or read IMDb trivia directly from their CINESCOPE profile.
     * -   **The Problem:** Users love live-reacting to crazy TV moments (like the Red Wedding in Game of Thrones) on Twitter, or reading deep lore on external databases like IMDb or TheTVDB, but finding the exact official handles or pages requires manually leaving the app and searching.    
     * -   **The Feature:** "The Superfan Deep-Link Hub." On the TV Show details page, CINESCOPE renders native, stylized icons for Twitter, Instagram, Facebook, and IMDb. When a user taps the Twitter icon, it uses the twitter_id to deep-link directly into the native Twitter app, instantly opening the show's official page so they can join the live conversation.
     * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
     * - If you notice in the OpenAPI definition, TMDB supports TheTVDB (tvdb_id) as an external source for TV shows.
     * - TheTVDB is another massive, community-driven database specifically built for television. If you ever find that TMDB is missing specific episode images or niche metadata for a very obscure show, you can use this tvdb_id to make a secondary API call directly to TheTVDB's API to fill in the gaps for your users!
     * - (And remember, you can append 'external_ids' to your main getTvShowDetails call to grab this instantly!)
     */
    getTvExternalIds(seriesId: number): Observable<TmdbTvExternalIdsDto> {
        return this.http.get<TmdbTvExternalIdsDto>(`${this.apiPrefix}/tv/${seriesId}/external_ids`);
    }

    /**
     * Get the images (backdrops, posters, logos) that belong to a TV series.
     * * @productContext
     * - Scenario 193 (The "Cinematic Theater" Mode): Fetch ultra-wide backdrops and transparent logos 
     * to build a premium, immersive, full-screen UI rather than just displaying text and a single static poster.
     * **The Problem:** The standard UI for TV shows is often just a boring vertical poster next to a wall of text. It feels like reading a Wikipedia page rather than stepping into an entertainment hub.
     * **The Feature:** "Dynamic Fanart Backgrounds." When a user navigates to the Stranger Things details page, CINESCOPE fetches the Images endpoint. It grabs the backdrops array, sorts it by vote_average to find the community's absolute favorite 4K wallpapers, and slowly cross-fades them as the full-screen background of the app. It also grabs the transparent logos array to overlay the show's official title treatment perfectly over the art, creating a premium, Netflix-style cinematic experience.
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code to filter images (defaults to 'en-US').
     * @param includeImageLanguage Optional comma separated string of language codes to include (e.g., 'en,null').
     * 
     * Pro-Tip for CINESCOPE
     * Pay very close attention to the includeImageLanguage parameter.
     * 
     * By default, if you pass language=en-US, TMDB will filter out every single image that doesn't explicitly have English text on it. This is great for posters, but terrible for backdrops, because most clean background wallpapers don't have any text on them (meaning their language is null).
     * 
     * To ensure you get localized posters and all the beautiful textless backgrounds, you should almost always pass:
     * includeImageLanguage: 'en,null'
     */
    getTvImages(
        seriesId: number,
        language?: string,
        includeImageLanguage?: string
    ): Observable<TmdbTvImagesResponseDto> {
        let params = this.buildParams({ language, includeImageLanguage });

        if (includeImageLanguage) params = params.set('include_image_language', includeImageLanguage);

        return this.http.get<TmdbTvImagesResponseDto>(`${this.apiPrefix}/tv/${seriesId}/images`, { params });
    }

    /**
     * Get a list of keywords that have been added to a TV show.
     * * @productContext
     * - Scenario 194 (The "Vibe Matcher"): Display these keywords as clickable tags on the TV show's page. 
     * When a user clicks one, grab its ID and pass it to the Discover API's `with_keywords` parameter 
     * to help them find other shows with the exact same hyper-specific themes.
     * 
     * The Problem: A user just finished Game of Thrones and wants something with the exact same "vibe." If they just click the "Sci-Fi & Fantasy" genre tag, they might get recommended Doctor Who or Stranger Things, which have completely different tones.

    **The Feature:** "Deep Discovery Tags." On the Game of Thrones details page, CINESCOPE displays the Keywords ("dragon", "based on novel or book", "intrigue") as a row of clickable pill buttons. When a user clicks the "political intrigue" pill, CINESCOPE routes them to the Discover TV endpoint, passing that specific keyword ID to generate a feed of shows with the exact same thematic elements.

    * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
    If you want to keep your API calls to an absolute minimum, remember that Keywords is another endpoint that perfectly supports the append_to_response parameter in the main TV Details call!

    You can simply add it to your comma-separated string when the user first opens the page:
    this.tvService.getTvShowDetails(1399, 'aggregate_credits,images,keywords')
     */
    getTvKeywords(seriesId: number): Observable<TmdbTvKeywordsResponseDto> {
        return this.http.get<TmdbTvKeywordsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/keywords`);
    }

    /**
     * Get the newest TV show ID that was just added to TMDB.
     * Note: This is a live response and will continuously change.
     * * @productContext
     * - Scenario 195 (The "Bleeding Edge" Indexer): Poll this endpoint in a background service to instantly 
     * discover and index brand new TV shows the second they are added to the global TMDB database.
     * 
     * **The Problem:** CINESCOPE wants to be the fastest entertainment app on the market, meaning it needs a page ready for a new TV show the absolute second it is announced to the world.
     * 
     * **The Feature:** CINESCOPE runs a background cron job that hits the Latest endpoint every few minutes. As soon as a brand new TV show ID is minted on TMDB, the app instantly grabs it, auto-generates a skeleton details page, and indexes it for Google SEO before competitors even know the show exists!
     * 
     * **Pro-Tip for CINESCOPE**
     * For the Latest endpoint, be very careful if you choose to render it directly to a user interface. Because TMDB is an open, community-edited database, the "latest" show is often a very obscure, empty, or unverified entry (like a random student film or a local public access show from another country) that someone just clicked "Save" on. It is usually best kept as an internal background tool for your servers!
     */
    getLatestTvShow(): Observable<TmdbTvDetailDto> {
        return this.http.get<TmdbTvDetailDto>(`${this.apiPrefix}/tv/latest`);
    }

    /**
     * Get the community-created lists that a TV series has been added to.
     * * @productContext
     * - Scenario 196 (The "Curated Rabbit Hole"): Surface these lists on the show's page so users can find 
     * hyper-specific, human-curated playlists (e.g., "Best Time Travel Shows") that feature the show they are viewing.
     * 
     * The Problem: Algorithmic "Similar Shows" are often too generic. If a user likes Dark, an algorithm might just suggest other German shows. The user actually wants highly specific, human-curated recommendations based on the vibe.
     * 
     * The Feature: On the TV Show details page, CINESCOPE queries the Lists endpoint. It surfaces community-made playlists that include the show, such as "Mind-Bending Time Travel Masterpieces" or "Shows That Require a Notebook to Understand." The user clicks the list and dives down a perfectly curated human rabbit hole!
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     */
    getTvLists(
        seriesId: number,
        language?: string,
        page?: number
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListResultDto>> {
        const params = this.buildParams({ language, page });

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListResultDto>>(`${this.apiPrefix}/tv/${seriesId}/lists`, { params });
    }

    /**
     * Get TV show recommendations for a specific TV show.
     * * @productContext
     * - Scenario 197 (The "Post-Binge Void" Filler): Call this endpoint immediately when a user marks a 
     * show as 'Completed' or finishes the final episode, providing them a frictionless path to their next binge.
     * The Problem: A user just finished the final episode of a gripping 6-season drama. They are experiencing the classic "post-binge void" and don't know what to do with their life now. If they close the app, they might not come back for days.
     * The Feature: "The Seamless Handoff." As the credits roll on the series finale, CINESCOPE instantly queries the Recommendations endpoint using the finished show's ID. The app slides up a sleek, horizontal carousel: "Because you loved Breaking Bad..." featuring perfectly algorithmic suggestions, seamlessly handing the user off to their next 6-season binge.    
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for CINESCOPE
     * It is important to understand how TMDB generates these. Recommendations are strictly algorithmic, based on user behavior across the TMDB platform (e.g., "Users who favorited X also favorited Y").
     * 
     * Later, we will see the Similar endpoint, which is based on metadata (e.g., "Show X and Show Y share the same genres and keywords").
     * 
     * If you want the absolute highest quality suggestions, Recommendations is usually the far superior endpoint because it relies on actual human viewing patterns!
     */
    getTvRecommendations(
        seriesId: number,
        language?: string,
        page?: number
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        const params = this.buildParams({ language, page });

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/tv/${seriesId}/recommendations`, { params });
    }

    /**
     * Get the user reviews that have been added to a TV show.
     * * @productContext
     * - Scenario 198 (The "Vibe Check" Feed): Display the latest user reviews directly on the TV Details page 
     * so potential viewers can get qualitative, spoiler-free opinions from the community before committing to a massive binge.
     * The Problem: A user is intrigued by a show's premise but sees a mediocre 6.5/10 average rating. They don't know if the low rating is because the first season is slow, or if the ending was terrible. They need context before committing 40 hours of their life to it.
     * The Feature: "Community Vibe Check." On the TV Show details page, CINESCOPE pulls the top 3 most recent reviews using this endpoint. It displays them in a sleek, scrollable horizontal list, allowing the user to quickly read spoiler-free opinions from real viewers to gauge if the show fits their personal taste.
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for CINESCOPE
     * When rendering the reviews in your Angular UI, be aware that the content string can sometimes be massively long. Users might write literal essays about why they hated the Game of Thrones finale.
     * 
     * You should implement an Angular Pipe or a CSS line-clamp rule to truncate the review text after 4 or 5 lines, and add a "Read More..." button that expands the text or opens a modal. This prevents one massive review from completely breaking your page layout!
     */
    getTvReviews(
        seriesId: number,
        language?: string,
        page?: number
    ): Observable<TmdbPaginatedResponseDto<TmdbReviewDto>> {
        const params = this.buildParams({ language, page });

        return this.http.get<TmdbPaginatedResponseDto<TmdbReviewDto>>(`${this.apiPrefix}/tv/${seriesId}/reviews`, { params });
    }

    /**
     * Get the seasons and episodes that have screened theatrically.
     * * @productContext
     * - Scenario 199 (The "Cinematic Scale" Badge): Cross-reference this array when building the episode list UI. 
     * Add a "Theatrical Event" badge to highlight massive, movie-budget episodes to users so they know to watch on their biggest screen.
     * The Problem: A user is binging a massive sci-fi show and wants to know when the budget absolutely skyrockets so they can switch from their phone to their 4K TV and surround sound system.
     * The Feature: "The IMAX Experience Badge." When rendering the list of episodes for a season, CINESCOPE silently checks the Screened Theatrically array. If an episode_number matches, it places a premium, glowing "Screened in Theaters" badge next to the runtime, signaling to the user that they are about to watch a movie-quality television event!
     * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
     * Because this endpoint just returns a list of integers (season_number and episode_number) rather than the full episode details, it is highly recommended to fetch this alongside the main TV show or Season data using append_to_response.
     * 
     * This way, when you loop through your rich episode objects to build the UI, you can easily do a quick array.find() against this theatrical list in memory without requiring a secondary network round-trip!
     */
    getTvScreenedTheatrically(seriesId: number): Observable<TmdbTvScreenedTheatricallyResponseDto> {
        return this.http.get<TmdbTvScreenedTheatricallyResponseDto>(`${this.apiPrefix}/tv/${seriesId}/screened_theatrically`);
    }

    /**
     * Get the similar TV shows based on shared genres and keywords.
     * * @productContext
     * - Scenario 200 (The "Genre Purist" Engine): Use this endpoint when users want shows that are structurally 
     * and thematically identical to the one they are viewing, rather than relying on algorithmic user viewing habits.
     * The Problem: A user loves Black Mirror specifically because it is an episodic sci-fi anthology. If they look at "Recommendations," the algorithm might suggest Stranger Things just because it's popular. But the user doesn't want an 80s nostalgia trip; they want exact structural matches.
     * The Feature: "The DNA Matcher." CINESCOPE places a "More Like This" tab next to "Viewer Recommendations." This tab uses the Similar endpoint to strictly match the underlying metadata (like the "anthology" and "dystopia" keywords), guaranteeing the user finds shows like The Twilight Zone or Electric Dreams that share the exact structural DNA of the show they just watched.
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for CINESCOPE
     * If your app design only has room for one row of suggestions beneath a TV show, a fantastic UX pattern is to actually fetch both Recommendations and Similar in the background.
     * 
     * You can then interleave or alternate the arrays in JavaScript before rendering them to the screen! This gives the user the best of both worlds: high-quality algorithmic hits mixed perfectly with deep-cut structural metadata matches.
     */
    getSimilarTvShows(
        seriesId: number,
        language?: string,
        page?: number
    ): Observable<TmdbPaginatedResponseDto<TmdbTvListItemDto>> {
        const params = this.buildParams({ language, page });

        return this.http.get<TmdbPaginatedResponseDto<TmdbTvListItemDto>>(`${this.apiPrefix}/tv/${seriesId}/similar`, { params });
    }

    /**
     * Get the translations that have been added to a TV show.
     * * @productContext
     * - Scenario 201 (The "Polyglot" Overview Toggle): Use this data to power an in-line language 
     * picker directly above the show's synopsis. This allows bilingual users to seamlessly read overviews 
     * in different languages without having to change their global app settings!
     * The Problem: A user is bilingual (e.g., they speak English and Arabic). They are browsing CINESCOPE in English, but they want to read the Arabic synopsis of a show to share with their parents. Standard apps force the user to go to the global settings menu, change the entire app's language to Arabic, read the synopsis, and then change it back.
     * The Feature: "In-Line Translation Picker." By fetching the Translations endpoint, CINESCOPE detects that an Arabic (ar) translation exists. It places a small, sleek language dropdown directly above the overview paragraph. The user selects "Arabic," and the text instantly swaps to the Arabic translation without reloading the page or altering their global app settings!
     * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
     * This is another phenomenal candidate for append_to_response!
     * 
     * If your app heavily caters to an international audience, you can append 'translations' to your initial getTvShowDetails request. Then, in your Angular component, you can quickly write a getter like:
     * 
     * TypeScript
     * get hasMultipleTranslations(): boolean {
     *    return this.tvShow.translations.translations.length > 1;
     * }
     * 
     * If it returns true, you render your sleek language toggle UI. If false, you hide it. It's completely dynamic and data-driven!
     */
    getTvTranslations(seriesId: number): Observable<TmdbTvTranslationsResponseDto> {
        return this.http.get<TmdbTvTranslationsResponseDto>(`${this.apiPrefix}/tv/${seriesId}/translations`);
    }

    /**
     * Get the videos (trailers, teasers, featurettes) that belong to a TV show.
     * * @productContext
     * - Scenario 202 (The "Binge-Prep Teaser" Player): Filter the results for official 'Trailer' types 
     * and use the `key` property to embed a native YouTube player directly into the TV show's hero header, 
     * dramatically increasing user conversion rates.
     * The Problem: A user is considering starting a massive 8-season epic like The Walking Dead, but they aren't sure if the tone is too scary for them. Reading text reviews isn't giving them the actual vibe of the cinematography and sound design.
     * The Feature: "In-App Cinematic Trailers." On the TV Show details page, CINESCOPE fetches the Videos array. It filters the array for objects where type === 'Trailer' and official === true. It takes the YouTube key and embeds a seamless, autoplaying, muted video header at the top of the page. The user gets instantly hooked by the visuals and sound without ever leaving the app.
     * * @param seriesId The TMDB TV Show ID.
     * @param language Optional ISO 639-1 language code to filter videos (defaults to 'en-US').
     * @param includeVideoLanguage Optional comma separated string of language codes to include as fallbacks (e.g., 'en,null').
     * 
     * Pro-Tip for CINESCOPE
     * Pay very close attention to the includeVideoLanguage parameter, just like we did with Images!
     * 
     * Often, a TV show might not have a localized "German" or "French" trailer uploaded to TMDB yet, but it will have an original English trailer. If you query language=de-DE without a fallback, the array will return empty.
     * 
     * To ensure your users always get some kind of video rather than a broken player, you should aggressively use the fallback parameter: includeVideoLanguage: 'de,en,null'.
     */
    getTvVideos(
        seriesId: number,
        language?: string,
        includeVideoLanguage?: string
    ): Observable<TmdbTvVideosResponseDto> {
        const params = this.buildParams({ language, includeVideoLanguage });

        return this.http.get<TmdbTvVideosResponseDto>(`${this.apiPrefix}/tv/${seriesId}/videos`, { params });
    }

    /**
     * Get the list of streaming, buying, and renting providers for a TV show by country.
     * * @productContext
     * - Scenario 203 (The "Where Can I Stream It?" Locator): Parse the `results` object using the user's 
     * local country code. Display the `flatrate` array to show users exactly which of their subscriptions 
     * currently carry the show, acting as the ultimate conversion funnel to get them watching.
     * 
     * The Problem: A user discovers an incredible-looking show on CINESCOPE, but they have no idea if it is included in their Netflix, Max, or Amazon Prime subscriptions. Googling "Where to stream [Show] in [My Country]" creates massive friction and pushes them out of your app.

     * The Feature: "The 1-Click Stream Hub." CINESCOPE fetches the Watch Providers endpoint. It detects the user's device region (e.g., US), grabs results['US'], and looks at the flatrate array. It immediately displays a localized row of logos: "Stream now on: [Netflix Logo] [Max Logo]". If the user taps the logo, it deep-links them straight into that specific streaming app to start episode 1!
     * * @param seriesId The TMDB TV Show ID.
     * 
     * Pro-Tip for CINESCOPE
     * When you render this in Angular, you do not want to loop over the entire results object. You should explicitly grab the user's localized data in your component logic.
     * 
     * TypeScript
     * // Assuming you have a user preferences service that knows they are in the US
     * const userCountry = 'US';
     * this.tvService.getTvWatchProviders(1399).subscribe(response => {
     *     // Safely extract just the US data, falling back to undefined if it's not available there
     *     const localProviders = response.results[userCountry]; 
     *     
     *     if (localProviders?.flatrate) {
     *         this.streamingServicesToRender = localProviders.flatrate;
     *     }
     * });
     * 
     * (Also, this is an excellent candidate for append_to_response: 'watch/providers' on your main details call so everything loads instantly!)
     */
    getTvWatchProviders(seriesId: number): Observable<TmdbTvWatchProvidersResponseDto> {
        return this.http.get<TmdbTvWatchProvidersResponseDto>(`${this.apiPrefix}/tv/${seriesId}/watch/providers`);
    }
}