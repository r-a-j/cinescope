import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbTvEpisodeGroupDetailDto } from '../../models/tmdb/tv-episode-groups/tv-episode-group-detail.dto';

@Injectable({ providedIn: 'root' })
export class TmdbTvEpisodeGroupsService {
    constructor(private http: HttpClient) { }

    /**
     * Get the deeply detailed, re-ordered episodes of a TV episode group.
     * This endpoint is the absolute holy grail for anime fans (who watch by "Story Arc" instead of seasons) and sci-fi fans (who need the "Chronological" or "DVD" order to make sense of a confusing broadcast history).
     * * @productContext
     * - Scenario 220 (The "Canon Reconstructor"): When a user selects an alternative viewing order 
     * (like 'Story Arc' or 'Chronological'), use this endpoint to fetch the `groups` array and completely 
     * rebuild the TV Show's UI to match the fan-preferred narrative timeline.
     * The Problem: A user wants to watch Batman: The Animated Series or Star Wars: The Clone Wars. If they watch using standard "Seasons," the timeline jumps back and forth wildly because the original network aired them out of order.
     * The Feature: "The True Timeline Viewer." When the user toggles "Sort by: Story Arc" on the TV show page, CINESCOPE takes the unique string ID (e.g., 5eb9938b60e0a26346d0000ce) and hits the Episode Group Details endpoint. It completely destroys the traditional "Season 1, Season 2" UI and replaces it with beautifully organized, community-curated buckets like "The Mandalore Plot Arc" or "Volume 1", rendering the episodes in their perfect, narrative sequence.
     * * @param episodeGroupId The unique alphanumeric TMDB string ID for the group (e.g., '5eb9938b60e0a26346d0000ce').
     * 
     * The Episode Groups Pro-Tips Masterclass
     * The "Anime" Secret Weapon (Absolute Type): Anime shows (like Naruto or One Piece) often don't have "Seasons" in Japan; they just broadcast continuously from Episode 1 to Episode 1000. If you are building an anime-focused view, always look for a group where type === TmdbTvEpisodeGroupType.Absolute (Type 2). It strips away western season numbers and just gives you the pure, sequential 1-to-1000 list!
     * Network-Specific Overrides: If network is populated (e.g., "Netflix"), that means this order represents how the show is displayed on that specific streaming service. For example, Netflix famously split Money Heist into different episodes/seasons than its original Spanish broadcast. If you detect the user is watching on Netflix (via your Watch Providers data), you can automatically switch to the Netflix Episode Group so your episode runtimes and synopses match their screen perfectly!
     * Client-Side Flattening: The groups array contains nested buckets. If your UI design doesn't support buckets (e.g., you just want one massive list of chronological episodes), you can easily flatten this array in your Angular RxJS pipeline using map(response => response.groups.flatMap(g => g.episodes)).
     */
    getTvEpisodeGroupDetails(episodeGroupId: string): Observable<TmdbTvEpisodeGroupDetailDto> {
        return this.http.get<TmdbTvEpisodeGroupDetailDto>(`/tv/episode_group/${episodeGroupId}`);
    }
}