import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbTvEpisodeDetailDto } from '../../models/tmdb/tv-episodes/tv-episode-detail.dto';
import { TmdbTvEpisodeChangesResponseDto } from '../../models/tmdb/tv-episodes/tv-episode-changes.dto';
import { TmdbTvEpisodeVideosResponseDto } from '../../models/tmdb/tv-episodes/tv-episode-videos.dto';
import { TmdbTvEpisodeCreditsResponseDto } from '../../models/tmdb/tv-episodes/tv-episode-credits.dto';
import { TmdbTvEpisodeExternalIdsDto } from '../../models/tmdb/tv-episodes/tv-episode-external-ids.dto';
import { TmdbTvEpisodeImagesResponseDto } from '../../models/tmdb/tv-episodes/tv-episode-images.dto';
import { TmdbTvEpisodeTranslationsResponseDto } from '../../models/tmdb/tv-episodes/tv-episode-translations.dto';

@Injectable({ providedIn: 'root' })
export class TmdbTvEpisodesService {
    constructor(private http: HttpClient) { }

    /**
     * Query the details of a specific TV episode.
     * * @productContext
     * - Scenario 213 (The "Smart Player" X-Ray): Use this endpoint to populate the metadata 
     * (runtime, synopsis, thumbnail) directly on the video player screen when a user starts an episode or hits pause.
     * The Problem: A user is watching the famous "Ozymandias" episode of Breaking Bad. They want to know exactly who directed this specific masterpiece and how long it is, without having to navigate all the way back up to the Season or Series pages.
     * The Feature: "Episode X-Ray." CINESCOPE uses the TV Episodes Details endpoint to power a pause-menu overlay. When the user hits pause, it displays the episode's name, overview, runtime, and a high-res thumbnail using the still_path, giving them total context for the exact 45 minutes of television they are currently consuming.
     * * @param seriesId The TMDB TV Show ID.
     * @param seasonNumber The sequential number of the season.
     * @param episodeNumber The sequential number of the episode within the season.
     * @param appendToResponse Comma-separated list of additional endpoints to append (e.g., 'credits,images').
     * @param language Optional ISO 639-1 language code (defaults to 'en-US').
     * 
     * Pro-Tip for getTvEpisodeDetails
     * The ultimate append_to_response payload!
     * If you are building an episode view, you want it to be as fast as possible. Because this endpoint supports append_to_response, you can fetch the episode details, the episode's specific cast, the episode's images, and the episode's videos all in one single shot:
     * 
     * TypeScript
     * this.episodesService.getTvEpisodeDetails(
     *     1399, 1, 1, 
     *     'credits,images,videos,translations'
     * );
     * 
     * This is how world-class applications minimize network waterfalls!
     */
    getTvEpisodeDetails(
        seriesId: number,
        seasonNumber: number,
        episodeNumber: number,
        appendToResponse?: string,
        language: string = 'en-US'
    ): Observable<TmdbTvEpisodeDetailDto> {
        let params = new HttpParams().set('language', language);

        if (appendToResponse) {
            params = params.set('append_to_response', appendToResponse);
        }

        return this.http.get<TmdbTvEpisodeDetailDto>(
            `/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
            { params }
        );
    }

    /**
     * Get the credits (cast, crew, guest stars) for a specific TV episode.
     * * @productContext Scenario 128 (The "Who Is That?!" Pause Overlay)
     * Scenario 214: The "Who Is That?!" Pause Overlay (Credits):
     * Feature: A user pauses a specific episode of Law & Order because they recognize the killer but can't name the actor. CINESCOPE uses the Episode Credits to show a highly contextual "In This Scene" overlay. Instead of returning the 500 actors from the whole series, it returns exactly the guest stars for this exact episode.
     * Guest Stars are the Goldmine! While standard series credits focus on the main recurring cast, the episode credits expose the guest_stars array. This is where you find the massive cameos (like Ed Sheeran in Game of Thrones or Brad Pitt in Friends). Prioritize rendering the guest_stars heavily in episode-specific UIs!
     */
    getTvEpisodeCredits(seriesId: number, seasonNumber: number, episodeNumber: number, language: string = 'en-US'): Observable<TmdbTvEpisodeCreditsResponseDto> {
        const params = new HttpParams().set('language', language);
        return this.http.get<TmdbTvEpisodeCreditsResponseDto>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}/credits`, { params });
    }

    /**
     * Get the external database IDs for a specific TV episode.
     * * @productContext Scenario 130 (The "Spoiler-Free Trivia")
     * Scenario 216: The "Spoiler-Free Trivia" (External IDs):
     * Feature: Using the Episode External IDs, CINESCOPE links users directly to the IMDb trivia page for just this specific episode (e.g., "The Rains of Castamere"). This guarantees they can read fun facts about the episode they just finished without accidentally reading who dies in the season finale!
     * (The Deep Link): When deep-linking to an episode's IMDb page, construct the URL using the imdb_id like this: https://www.imdb.com/title/${imdb_id}/. This bypasses the main show page entirely, keeping your users completely safe from future spoilers.
     */
    getTvEpisodeExternalIds(seriesId: number, seasonNumber: number, episodeNumber: number): Observable<TmdbTvEpisodeExternalIdsDto> {
        return this.http.get<TmdbTvEpisodeExternalIdsDto>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}/external_ids`);
    }

    /**
     * Get the images (stills) for a specific TV episode.
     * * @productContext Scenario 131 (The "Visual Scrubber")
     * Scenario 217: The "Visual Scrubber" (Images):
     * Feature: When a user scrubs through the timeline of an episode on the CINESCOPE video player, the app uses the Episode Images (stills) endpoint to render beautiful, high-res preview thumbnails above the progress bar.
     * (Beware of Spoilers!): Episode stills are notoriously spoiler-heavy. If an episode is marked as unwatched by your user, you should apply a CSS backdrop-filter: blur(10px) to the images returned by this endpoint. Reveal the crystal-clear image only after they hit "Watched"!
     */
    getTvEpisodeImages(seriesId: number, seasonNumber: number, episodeNumber: number, language?: string): Observable<TmdbTvEpisodeImagesResponseDto> {
        let params = new HttpParams();
        if (language) params = params.set('language', language);
        return this.http.get<TmdbTvEpisodeImagesResponseDto>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}/images`, { params });
    }

    /**
     * Get the translations for a specific TV episode.
     * * @productContext Scenario 132 (The "Global Title Flip"),
     * Scenario 218: The "Global Title Flip" (Translations):
     * Feature: Famous episodes often have completely different titles in different regions. If a French user is browsing, CINESCOPE hits the Episode Translations endpoint to instantly swap the English title "Winter is Coming" to "L'hiver vient" without reloading the view.
     */
    getTvEpisodeTranslations(seriesId: number, seasonNumber: number, episodeNumber: number): Observable<TmdbTvEpisodeTranslationsResponseDto> {
        return this.http.get<TmdbTvEpisodeTranslationsResponseDto>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}/translations`);
    }

    /**
     * Get the videos (promos, teasers) for a specific TV episode.
     * * @productContext Scenario 129 (The "Next Time On..." Auto-Play)
     * Scenario 215: The "Next Time On..." Auto-Play (Videos):
     * Feature: When the credits roll on Episode 4, CINESCOPE automatically queries the Episode Videos for Episode 5. It filters for type === 'Promo' or 'Teaser' and seamlessly auto-plays the official "Next time on..." preview to ensure the user keeps watching.
     * (The "Promo" Type): Unlike movies where you want "Trailers", for TV episodes you usually want to filter the results array for type === 'Promo' or type === 'Teaser'. This captures the classic "Next week on..." clips that air at the end of TV broadcasts.
     */
    getTvEpisodeVideos(seriesId: number, seasonNumber: number, episodeNumber: number, language?: string, includeVideoLanguage?: string): Observable<TmdbTvEpisodeVideosResponseDto> {
        let params = new HttpParams();
        if (language) params = params.set('language', language);
        if (includeVideoLanguage) params = params.set('include_video_language', includeVideoLanguage);
        return this.http.get<TmdbTvEpisodeVideosResponseDto>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}/videos`, { params });
    }

    /**
     * Get the recent changes for a specific TV episode.
     * Note: Requires the unique TMDB Episode ID, NOT the Series ID and Season/Episode Number!
     * * @productContext Scenario 133 (The "Leak Detector")
     * Scenario 219: The "Leak Detector" (Changes):
     * Feature: For ultra-secretive shows like The Last of Us, TMDB moderators lock down episode titles until the day before release. CINESCOPE polls the Episode Changes endpoint in the background to instantly notify hardcore fans the second an episode's title or runtime is added to the global database.
     * (The ID Trap): Just like seasons, you cannot use /tv/1399/season/1/episode/1/changes. You must extract the unique _id or id (e.g., 63056) from the Episode Details call first, then pass it to getTvEpisodeChanges(63056).
     */
    getTvEpisodeChanges(episodeId: number, startDate?: string, endDate?: string, page: number = 1): Observable<TmdbTvEpisodeChangesResponseDto> {
        let params = new HttpParams().set('page', page.toString());
        if (startDate) params = params.set('start_date', startDate);
        if (endDate) params = params.set('end_date', endDate);
        return this.http.get<TmdbTvEpisodeChangesResponseDto>(`/tv/episode/${episodeId}/changes`, { params });
    }
}