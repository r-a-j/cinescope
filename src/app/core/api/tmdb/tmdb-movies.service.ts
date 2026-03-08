import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbCertificationResponseDto } from '../../models/tmdb/common/certification.dto';
import { TmdbNowPlayingResponseDto } from '../../models/tmdb/movies/now-playing.dto';
import { TmdbMovieListItemDto } from '../../models/tmdb/movies/movie-list-item.dto';
import { TmdbPaginatedResponseDto } from '../../models/tmdb/common/paginated-response.dto';
import { TmdbUpcomingResponseDto } from '../../models/tmdb/movies/upcoming.dto';
import { TmdbMovieDetailDto } from '../../models/tmdb/movies/movie-detail.dto';
import { TmdbMovieAlternativeTitlesResponseDto } from '../../models/tmdb/movies/movie-alternative-titles.dto';
import { TmdbMovieChangesResponseDto } from '../../models/tmdb/movies/movie-changes.dto';
import { TmdbMovieCreditsResponseDto } from '../../models/tmdb/movies/movie-credits.dto';
import { TmdbMovieExternalIdsDto } from '../../models/tmdb/movies/movie-external-ids.dto';
import { TmdbMovieImagesResponseDto } from '../../models/tmdb/movies/movie-images.dto';
import { TmdbMovieKeywordsResponseDto } from '../../models/tmdb/movies/movie-keywords.dto';
import { TmdbMovieListReferenceDto } from '../../models/tmdb/movies/movie-list-reference.dto';
import { TmdbMovieReleaseDatesResponseDto } from '../../models/tmdb/movies/movie-release-dates.dto';
import { TmdbReviewDto } from '../../models/tmdb/reviews/review.dto';
import { TmdbMovieTranslationsResponseDto } from '../../models/tmdb/movies/movie-translations.dto';
import { TmdbMovieVideosResponseDto } from '../../models/tmdb/movies/movie-videos.dto';
import { TmdbMovieWatchProvidersResponseDto } from '../../models/tmdb/movies/movie-watch-providers.dto';

@Injectable({ providedIn: 'root' })
export class TmdbMoviesService {
    constructor(private http: HttpClient) { }

    /**
     * Get an up to date list of the officially supported movie certifications on TMDB.
     */
    getMovieCertifications(): Observable<TmdbCertificationResponseDto> {
        return this.http.get<TmdbCertificationResponseDto>('/certification/movie/list');
    }

    /**
     * Get a list of movies that are currently in theatres.
     * Note: This is essentially a specialized 'discover' call.
     * * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * @param region Optional ISO-3166-1 region code to get regional release dates.
     * 
     * This is a fantastic addition. The "Now Playing" endpoint is crucial for the "Theatrical Releases" 
     * features of CINESCOPE, specifically addressing Scenario 52: The "Let's Actually Go Out" Alert.
     * 
     * Implementation Notes:
     * 
     * The region parameter is particularly powerful. If you detect a user is in Germany (de), 
     * passing region: 'DE' ensures that the movie "Oppenheimer" appears on their list if it's 
     * playing there, even if it hasn't been released in the US yet (or vice versa).
     * 
     * For the "Date Night" feature (Scenario 53), you can use this endpoint to find movies 
     * that are playing *this weekend*. You can then cross-reference the release_dates field 
     * (which you'll get from the Movie Details endpoint) to ensure the movie has a "Theatrical 
     * Release" status in the user's country, filtering out any VOD-only titles that might 
     * appear in the raw list.
     */
    getNowPlayingMovies(
        language: string = 'en-US',
        page: number = 1,
        region?: string
    ): Observable<TmdbNowPlayingResponseDto> {
        let params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        if (region) {
            params = params.set('region', region);
        }

        return this.http.get<TmdbNowPlayingResponseDto>('/movie/now_playing', { params });
    }

    // You already have a version of this in your old tmdb-search.service.ts called getIndianTheatrical.

    // In the new Clean Architecture, your MediaRepository (the Adapter) will call this new 
    // getNowPlayingMovies method. If the user's settings indicate they are in India (de), 
    // passing region: 'IN' into this method, making it infinitely more scalable than hardcoding 
    // "India" into the base service.

    /**
     * Get a list of movies ordered by popularity.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * @param region Optional ISO-3166-1 region code.
     */
    getPopularMovies(
        language: string = 'en-US',
        page: number = 1,
        region?: string
    ): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        let params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        if (region) {
            params = params.set('region', region);
        }

        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>('/movie/popular', { params });
    }

    // The "Popular" endpoint is your ultimate "Cold Start" solution.

    // When a brand-new user downloads CINESCOPE and opens the app for the very first time, 
    // you don't have any data on them yet to use the complex Discover filters.

    // Calling getPopularMovies gives you a highly engaging, mainstream list of 20 movies 
    // to populate the UI immediately.

    // You can use this feed to implement a quick "Onboarding Swipe" feature (similar to 
    // your Tinder-style UI in inbox.component.ts), where they swipe right on popular 
    // movies they like, instantly giving your app the baseline data it needs to start 
    // generating hyper-personalized recommendations later!

    /**
     * Get a list of movies ordered by rating.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * @param region Optional ISO-3166-1 region code.
     */
    getTopRatedMovies(
        language: string = 'en-US',
        page: number = 1,
        region?: string
    ): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        let params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        if (region) params = params.set('region', region);

        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>('/movie/top_rated', { params });
    }

    /**
     * Get a list of movies that are being released soon.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * @param region Optional ISO-3166-1 region code to get regional release dates.
     */
    getUpcomingMovies(
        language: string = 'en-US',
        page: number = 1,
        region?: string
    ): Observable<TmdbUpcomingResponseDto> {
        let params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        if (region) params = params.set('region', region);

        return this.http.get<TmdbUpcomingResponseDto>('/movie/upcoming', { params });
    }

    // This perfectly handles Scenario 27: The "Hype Tracker" from your product roadmap.
    // When users open the app and tap the "Upcoming" tab, you can call getUpcomingMovies(), 
    // look at the release_date of each TmdbMovieListItemDto, and dynamically calculate how many 
    // days are left until it hits theaters.

    // You can even combine this with the region parameter. If a user's phone is set to Germany 
    // (region: 'DE'), they won't get hyped for a US release date that doesn't apply to them—they 
    // will see the exact release date for their local cinemas.

    /**
     * Get the top level details of a movie by ID.
     * @param movieId The TMDB Movie ID.
     * @param appendToResponse Comma separated list of endpoints within this namespace (e.g., 'videos,credits,similar').
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * By moving this to the new TmdbMoviesService with appendToResponse as an injectable parameter, 
     * you decouple the caching logic from the HTTP call and give your UI components complete control 
     * over what data they want to load.
     * 
     * For example, if your BaseMediaDetailPage only needs the trailer, you can just append videos. 
     * If it needs the full cast list for the "Actor Marathon" feature, you can append credits.
     */
    getMovieDetails(
        movieId: number,
        appendToResponse?: string,
        language: string = 'en-US'
    ): Observable<TmdbMovieDetailDto> {
        let params = new HttpParams().set('language', language);

        if (appendToResponse) {
            params = params.set('append_to_response', appendToResponse);
        }

        return this.http.get<TmdbMovieDetailDto>(`/movie/${movieId}`, { params });
    }

    /**
     * Get the alternative titles for a movie.
     * @param movieId The TMDB Movie ID.
     * @param country Optional ISO-3166-1 value to filter the results (e.g., 'US', 'DE').
     * 
     * Pro-Tip for CINESCOPE
     * Because we just implemented the Movie Details append_to_response feature in the previous step, 
     * you actually have two ways to get this data in your app!
     * 
     * Standalone Fetch: Use getMovieAlternativeTitles(550, 'MX') if you only need the titles in a 
     * specific sub-menu.
     * 
     * Appended Fetch (Recommended for performance): You can simply call your main Movie Details 
     * service and append it:
     * getMovieDetails(550, 'alternative_titles')
     * When you do this, TMDB will attach an alternative_titles property to your TmdbMovieDetailDto, 
     * saving the user's mobile data by preventing an extra HTTP request!
     */
    getMovieAlternativeTitles(movieId: number, country?: string): Observable<TmdbMovieAlternativeTitlesResponseDto> {
        let params = new HttpParams();

        if (country) {
            params = params.set('country', country);
        }

        return this.http.get<TmdbMovieAlternativeTitlesResponseDto>(`/movie/${movieId}/alternative_titles`, { params });
    }

    /**
     * Get the recent changes for a movie.
     * By default only the last 24 hours are returned. You can query up to 14 days in a single query.
     * @param movieId The TMDB Movie ID.
     * @param startDate Optional start date for the query (Format: YYYY-MM-DD).
     * @param endDate Optional end date for the query (Format: YYYY-MM-DD).
     * @param page The page number to fetch (defaults to 1).
     * 
     * CINESCOPE USE CASE: The "Content Refresh" Feature
     * Imagine you want to implement a "What's New in the Last 7 Days?" section for your power users.
     * 
     * You can call this method with a start_date set to 7 days ago and an end_date set to today.
     * 
     * const sevenDaysAgo = new Date();
     * sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
     * 
     * this.tmdbMoviesService.getMovieChanges(
     *   550, 
     *   sevenDaysAgo.toISOString().split('T')[0], 
     *   new Date().toISOString().split('T')[0]
     * );
     * 
     * This will return a list of all movies that had any changes (posters, keywords, plot, etc.) 
     * in the last week, allowing you to curate a "Fresh Arrivals" list that is dynamically 
     * generated from the latest TMDB updates!
     */
    getMovieChanges(
        movieId: number,
        startDate?: string,
        endDate?: string,
        page: number = 1
    ): Observable<TmdbMovieChangesResponseDto> {
        let params = new HttpParams().set('page', page.toString());

        if (startDate) params = params.set('start_date', startDate);
        if (endDate) params = params.set('end_date', endDate);

        return this.http.get<TmdbMovieChangesResponseDto>(`/movie/${movieId}/changes`, { params });
    }

    /**
     * Get the cast and crew for a movie.
     * @param movieId The TMDB Movie ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * CINESCOPE USE CASE: The "Actor Marathon" Feature
     * Imagine a user loves Tom Hanks. Instead of just seeing "Tom Hanks" in the cast list, 
     * you can use this endpoint to power a full-screen experience:
     * 
     * 1. Fetch Credits: Call getMovieCredits(550) to get the full cast.
     * 2. Find Actor: Locate Tom Hanks in the cast array.
     * 3. Fetch Actor Details: Use his tmdb_id to call the People API (which we will build next!).
     * 4. Display Marathon: Show all movies he starred in (from the People API response) 
     *    in a scrollable list, letting the user binge-watch his filmography!
     */
    getMovieCredits(movieId: number, language: string = 'en-US'): Observable<TmdbMovieCreditsResponseDto> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbMovieCreditsResponseDto>(`/movie/${movieId}/credits`, { params });
    }

    /**
     * Get the external IDs for a movie.
     * @param movieId The TMDB Movie ID.
     * 
     * Pro-Tip for CINESCOPE
     * If you want to build a truly premium social experience in CINESCOPE, you can use these IDs to link out to other apps.
     * 
     * For example, on your BaseMediaDetailPage, if instagram_id is present, you can render an Instagram icon. When the user taps it, you don't just open the browser—you can use Deep Linking to open the native Instagram app directly to that movie's official page:
     * window.location.href = 'instagram://user?username=' + movie.instagram_id;
     * 
     * (Remember, just like Alternative Titles, you can also get this data for "free" by appending 'external_ids' to your getMovieDetails call!)
     */
    getMovieExternalIds(movieId: number): Observable<TmdbMovieExternalIdsDto> {
        return this.http.get<TmdbMovieExternalIdsDto>(`/movie/${movieId}/external_ids`);
    }

    /**
     * Get the images that belong to a movie (backdrops, posters, logos).
     * @param movieId The TMDB Movie ID.
     * @param includeImageLanguage Comma separated ISO-639-1 values to query (e.g., 'en,null').
     * @param language Optional ISO 639-1 language code.
     * 
     * CINESCOPE USE CASE: The "Dynamic Gallery" Feature
     * Imagine you want to implement a "View All Images" screen for a movie.
     * 
     * You can call this method with include_image_language set to 'en,null'.
     * 
     * this.tmdbMoviesService.getMovieImages(550, 'en,null').subscribe(response => {
     *   // response.posters contains English posters
     *   // response.backdrops contains English backdrops
     *   // response.logos contains logos (usually language-agnostic)
     * });
     * 
     * This will return a list of all images for the movie, allowing you to display them in a 
     * scrollable gallery, just like the official TMDB website!
     */
    getMovieImages(
        movieId: number,
        includeImageLanguage?: string,
        language?: string
    ): Observable<TmdbMovieImagesResponseDto> {
        let params = new HttpParams();

        if (includeImageLanguage) {
            params = params.set('include_image_language', includeImageLanguage);
        }
        if (language) {
            params = params.set('language', language);
        }

        return this.http.get<TmdbMovieImagesResponseDto>(`/movie/${movieId}/images`, { params });
    }

    /**
     * Get the keywords that have been added to a movie.
     * @param movieId The TMDB Movie ID.
     * 
     * CINESCOPE USE CASE: The "Genre Tag Cloud" Feature
     * Imagine you want to implement a "Tag Cloud" section on your movie detail page to show 
     * the main themes of the movie (e.g., "revenge", "heist", "space").
     * 
     * You can call this method and map the response to a list of tags:
     * 
     * this.tmdbMoviesService.getMovieKeywords(550).subscribe(response => {
     *   // response.keywords is an array of { id, name }
     *   const tags = response.keywords.map(k => k.name);
     *   // tags = ["based on novel", "revenge", "detective", ...]
     * });
     * 
     * This gives you a dynamic, user-generated (via TMDB) list of tags that perfectly 
     * describes the movie's content!
     * 
     * Pro-Tip for CINESCOPE
     * If you want to build a truly premium social experience in CINESCOPE, you can use these IDs to link out to other apps.
     * 
     * For example, on your BaseMediaDetailPage, if instagram_id is present, you can render an Instagram icon. 
     * When the user taps it, you don't just open the browser—you can use Deep Linking to open the native Instagram app directly to that movie's official page:
     * window.location.href = 'instagram://user?username=' + movie.instagram_id;
     * 
     * (Remember, just like Alternative Titles, you can also get this data for "free" by appending 'external_ids' to your getMovieDetails call!)
     * 
     * Pro-Tip for CINESCOPE
     * If you are using the append_to_response trick we set up in getMovieDetails, you can actually fetch these keywords at the exact same time as the movie details by passing 'keywords' in the append string!
     * 
     * For example:
     * this.moviesService.getMovieDetails(550, 'images,credits,keywords')
     * 
     * This means when the BaseMediaDetailPage loads, you instantly have the poster, the cast list, AND the clickable keyword tags without making four separate network requests.
     */
    getMovieKeywords(movieId: number): Observable<TmdbMovieKeywordsResponseDto> {
        return this.http.get<TmdbMovieKeywordsResponseDto>(`/movie/${movieId}/keywords`);
    }

    /**
     * Get the newest movie added to the TMDB database.
     * Note: This is a live response and will continuously change.
     * 
     * Pro-Tip for CINESCOPE
     * Because TMDB is a community-driven database, the "Latest" movie is usually an incredibly obscure indie film, 
     * a student short film, or a regional release that someone just added to the database 5 seconds ago (as seen in your example: König Charles III with 0 popularity and 0 votes).
     * 
     * While you might not want to put this on the main "Discover" feed (since it lacks posters or trailers usually), 
     * it makes for a fantastic "Easter Egg" feature or a "Live Ticker" in the app's settings menu, 
     * showing users the raw, live pulse of global cinema being cataloged in real-time.
     */
    getLatestMovie(): Observable<TmdbMovieDetailDto> {
        return this.http.get<TmdbMovieDetailDto>('/movie/latest');
    }

    /**
     * Get the lists that a movie has been added to.
     * @param movieId The TMDB Movie ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for CINESCOPE
     * If you want to implement a "Curated by the Community" section at the bottom of your BaseMediaDetailPage, this is the endpoint you use.
     * 
     * If a user is looking at Fight Club, calling this endpoint might return a user-generated list called "Mind-Bending Thrillers." 
     * If the user clicks that list, you can route them to a new page that fetches the contents of list ID 8211179, 
     * essentially acting as an organic, human-curated recommendation engine!
     */
    getMovieLists(
        movieId: number,
        language: string = 'en-US',
        page: number = 1
    ): Observable<TmdbPaginatedResponseDto<TmdbMovieListReferenceDto>> {
        const params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListReferenceDto>>(`/movie/${movieId}/lists`, { params });
    }

    /**
     * Get a list of recommended movies for a movie.
     * @param movieId The TMDB Movie ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for CINESCOPE
     * This endpoint is the engine that drives your "Post-Watch" lifecycle.
     * 
     * When a user finishes a movie and wants more of the exact same vibe, you use this endpoint. 
     * It directly supports Scenario 14: The "Obsessive Rabbit Hole". 
     * While keyword discovery gives you hyper-specific tropes (like "desert planet"), 
     * the TMDB Recommendation algorithm looks at a combination of genres, keywords, and user viewing habits to give you the most accurate algorithmic match.
     * 
     * (And just like the others, if you want this data immediately when loading a movie page, 
     * you can just append 'recommendations' to your getMovieDetails call!)
     */
    getMovieRecommendations(
        movieId: number,
        language: string = 'en-US',
        page: number = 1
    ): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        const params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>(`/movie/${movieId}/recommendations`, { params });
    }

    /**
     * Get the release dates and certifications for a movie.
     * @param movieId The TMDB Movie ID.
     * 
     * This endpoint is an absolute goldmine for CINESCOPE because it provides two critical pieces of localized information: exactly when a movie is available in a user's country, and what age rating (certification) it has there.
     * 
     * For example, if a user in the UK is looking at a movie, you can check the 'results' array for the 'GB' (Great Britain) object. 
     * Inside that object, you will find the 'release_dates' array, which tells you the exact date and certification (e.g., '15' for 15 and over).
     * 
     * This is the data you need to power your "Release Calendar" feature and ensure you are showing the correct age restrictions to your users!
     * 
     * Pro-Tip for CINESCOPE
     * This endpoint is the key to unlocking Scenario 9: The "Parent in the Room" Panic from your product roadmap.
     * 
     * By looking at the user's localized region setting (e.g., DE for Germany), you can filter the results array to find the matching iso_3166_1 block. 
     * Inside that block, the certification property tells you the exact age rating.
     * 
     * If a user tries to play Fight Club while the app is in "Family Mode", your app can instantly intercept: 
     * "Warning: This is rated 18 in your region. Are you sure you want to put this on the living room TV?" 
     * (Note: Just like Keywords and Credits, you can fetch this automatically alongside the main movie data by appending 'release_dates' to your getMovieDetails call!)
     */
    getMovieReleaseDates(movieId: number): Observable<TmdbMovieReleaseDatesResponseDto> {
        return this.http.get<TmdbMovieReleaseDatesResponseDto>(`/movie/${movieId}/release_dates`);
    }

    /**
     * Get the user reviews for a movie.
     * @param movieId The TMDB Movie ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * This endpoint is fantastic because it gives you access to long-form community sentiment, which is essential for building the social and debate-driven features you outlined in your product roadmap (like Scenario 35: The "Debate Settler").
     * 
     * Because this endpoint returns a paginated list of reviews, we get to reuse our trusty TmdbPaginatedResponseDto. However, we need to create a DTO for the review object itself. Since TV Shows use this exact same review structure, we will put this in a generic reviews folder so it can be shared.
     * 
     * Pro-Tip for CINESCOPE
     * If you look closely at the avatar_path in your JSON response, TMDB sometimes returns full URLs from Gravatar (e.g., "/https://secure.gravatar.com/avatar/..."), and sometimes they return standard relative TMDB paths.
     * 
     * When you render these reviews in your app's UI, you will need a small utility pipe or function in Angular to clean up that avatar_path. If it starts with "/https", you simply slice off the first slash. If it's a normal path, you append your TMDB Image Base URL to it.
     * 
     * This is a great feature to append directly to the getMovieDetails call (e.g., append_to_response=reviews) to instantly load the top 3 community reviews at the bottom of the movie page to give users a sense of the community consensus before they watch.
     */
    getMovieReviews(
        movieId: number,
        language: string = 'en-US',
        page: number = 1
    ): Observable<TmdbPaginatedResponseDto<TmdbReviewDto>> {
        const params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbReviewDto>>(`/movie/${movieId}/reviews`, { params });
    }

    /**
     * Get similar movies based on genres and keywords.
     * Note: These results are based on metadata, unlike 'Recommendations' which uses user-behavior algorithms.
     * @param movieId The TMDB Movie ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * @param page The page number to fetch (defaults to 1).
     * 
     * Pro-Tip for CINESCOPE: "Similar" vs "Recommendations"
     * You might be wondering: Why does TMDB have both a Similar endpoint and a Recommendations endpoint?
     * 
     * getMovieRecommendations uses TMDB's internal algorithm based on user behavior (e.g., "People who watched Fight Club also watched The Matrix"). It's great for a "You Might Also Like" section.
     * 
     * getSimilarMovies is purely a metadata match based on Genres and Keywords (e.g., "This movie is a 1990s Thriller about Identity; here are other 1990s Thrillers about Identity").
     * 
     * In your BaseMediaDetailPage, you can actually use both! You could have one carousel titled "Because you watched this" (Recommendations) and right below it, a carousel titled "More like this genre" (Similar).
     * 
     * (And yes, you can get this for free by appending 'similar' to your getMovieDetails call!)
     */
    getSimilarMovies(
        movieId: number,
        language: string = 'en-US',
        page: number = 1
    ): Observable<TmdbPaginatedResponseDto<TmdbMovieListItemDto>> {
        const params = new HttpParams()
            .set('language', language)
            .set('page', page.toString());

        return this.http.get<TmdbPaginatedResponseDto<TmdbMovieListItemDto>>(`/movie/${movieId}/similar`, { params });
    }

    /**
     * Get the translations for a movie.
     * @param movieId The TMDB Movie ID.
     * 
     * This endpoint is incredibly useful for making CINESCOPE a truly global application. While you can always pass a language parameter to the main getMovieDetails call, fetching the translations directly allows you to see every localized version of the title, overview, and tagline all at once.
     * 
     * Pro-Tip for CINESCOPE
     * This endpoint provides a brilliant, lightweight way to handle Contextual Fallbacks.
     * 
     * Imagine a user in Germany is using CINESCOPE in German (language=de-DE), but they are looking at an obscure Japanese indie film that has no German overview written in the TMDB database yet.
     * 
     * Instead of showing a blank, broken screen, your UI layer can check if the overview is empty. If it is, it can quickly scan this translations array, find the English (en) or Original Language (ja) fallback, and display that instead with a tiny note: "Translated overview not available. Showing original."
     * 
     * (And as always, you can retrieve this instantly by adding 'translations' to your append_to_response string in getMovieDetails!)
     */
    getMovieTranslations(movieId: number): Observable<TmdbMovieTranslationsResponseDto> {
        return this.http.get<TmdbMovieTranslationsResponseDto>(`/movie/${movieId}/translations`);
    }

    /**
     * Get the videos that have been added to a movie.
     * @param movieId The TMDB Movie ID.
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for CINESCOPE
     * This endpoint returns everything—from 3-minute official trailers to 15-second TV spots and behind-the-scenes featurettes.
     * 
     * When integrating this into CINESCOPE, you almost always want to filter the results array in your component before displaying it. For the main "Play Trailer" button on your BaseMediaDetailPage, you should look for the object where type === 'Trailer' and official === true.
     * 
     * Also, this plays perfectly into Scenario 67: The "Autoplay Panic" from your roadmap. Because you control the video playback via the key property (e.g., embedding a YouTube iframe with https://www.youtube.com/embed/${video.key}), you can programmatically ensure that trailers never autoplay unless the user has explicitly disabled "Zen Browsing Mode" in their app settings.
     * 
     * (And as the final reminder for the Movies namespace: by calling getMovieDetails(id, 'videos,images,credits'), you can get the movie details, the posters, the cast, AND the trailer all in one single HTTP request!)
     */
    getMovieVideos(movieId: number, language: string = 'en-US'): Observable<TmdbMovieVideosResponseDto> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbMovieVideosResponseDto>(`/movie/${movieId}/videos`, { params });
    }

    /**
     * Get the list of streaming providers we have for a movie.
     * Powered by JustWatch.
     * @param movieId The TMDB Movie ID.
     * 
     * The Watch Providers endpoint is what powers Scenario 13: "Where the Heck is it Streaming?" (The "My Wallet Filter") and Scenario 40: "The FAST Channel Finder" from your product roadmap. Without this data, users will find a movie in CINESCOPE but then have to open Google just to figure out how to actually watch it.
     * 
     * Because TV Shows will use the exact same provider data structure, we should place the base interfaces in a shared watch-providers folder.    
     * 
     * Pro-Tip for CINESCOPE
     * Here is exactly how you handle this data in your Angular component to make it user-friendly:
     * 
     * When you fetch this endpoint, you get the data for the entire world. You don't want to show a user in the US that the movie is available on "Hotstar in India."
     * 
     * In your UI layer (or your Repository/Adapter), you will grab the user's localized region from their settings (e.g., const userRegion = 'US';), and then extract only that block:
     * 
     * const regionalData = response.results[userRegion];
     * 
     * if (regionalData) {
     *     console.log('Stream it on:', regionalData.flatrate);
     *     console.log('Rent it on:', regionalData.rent);
     * } else {
     *     console.log('Not available in your country currently.');
     * }
     * 
     * Crucial Legal Note: As the documentation points out, because this data comes from JustWatch, you must display the JustWatch logo and/or give attribution somewhere in your UI.
     * 
     * (And yes, to save network calls, you can fetch this by simply appending 'watch/providers' to your main getMovieDetails call!)
     */
    getMovieWatchProviders(movieId: number): Observable<TmdbMovieWatchProvidersResponseDto> {
        return this.http.get<TmdbMovieWatchProvidersResponseDto>(`/movie/${movieId}/watch/providers`);
    }
}