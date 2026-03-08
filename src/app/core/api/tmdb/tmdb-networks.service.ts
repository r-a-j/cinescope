import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TmdbNetworkDetailDto } from '../../models/tmdb/networks/network-detail.dto';
import { TmdbNetworkAlternativeNamesResponseDto } from '../../models/tmdb/networks/network-alternative-names.dto';
import { TmdbNetworkImagesResponseDto } from '../../models/tmdb/networks/network-images.dto';

@Injectable({ providedIn: 'root' })
export class TmdbNetworksService {
    constructor(private http: HttpClient) { }

    /**
     * Get the details of a TV network by ID.
     * @param networkId The TMDB Network ID (e.g., 49 for HBO).
     * 
     * Pro-Tip for CINESCOPE
     * This endpoint is incredibly useful for Scenario 38: The "Binge & Bail" Strategy from your product roadmap.
     * 
     * If you are tracking which networks a user frequently watches (by checking the networks array returned in TV Show details), 
     * you can use this endpoint to grab the official logo_path and render a beautiful, dynamic "Subscription Roadmap" UI. For example, 
     * you can display the HBO logo next to a list of shows the user wants to watch, allowing them to easily see which platform they should 
     * subscribe to this month.
     */
    getNetworkDetails(networkId: number): Observable<TmdbNetworkDetailDto> {
        return this.http.get<TmdbNetworkDetailDto>(`/network/${networkId}`);
    }

    /**
     * Get the alternative names of a network.
     * @param networkId The TMDB Network ID.
     * 
     * Pro-Tip for CINESCOPE
     * If you plan on building a comprehensive "Network/Studio Hub" in your app where users can browse all shows produced by a specific network, 
     * you can use these alternative names in your internal search index. That way, if a user searches for "Home Box Office" instead of "HBO", 
     * your app is smart enough to route them to the correct hub page!
     */
    getNetworkAlternativeNames(networkId: number): Observable<TmdbNetworkAlternativeNamesResponseDto> {
        return this.http.get<TmdbNetworkAlternativeNamesResponseDto>(`/network/${networkId}/alternative_names`);
    }

    /**
     * Get the TV network logos by ID.
     * @param networkId The TMDB Network ID.
     * 
     * Pro-Tip for CINESCOPE
     * As noted in the TMDB documentation you provided: "We prefer SVG's as they are resolution independent... An SVG can be scaled properly beyond those dimensions if you call them as a PNG."
     * 
     * When you build the UI for Scenario 38: The "Binge & Bail" Strategy, you will likely display a grid of streaming platforms (Netflix, Apple TV, HBO).   
     * To ensure your app looks premium and incredibly crisp on high-DPI mobile screens (like iPhones and high-end Androids), you should map through the logos array and always try to select the object where file_type === '.svg' before falling back to .png.
     */
    getNetworkImages(networkId: number): Observable<TmdbNetworkImagesResponseDto> {
        return this.http.get<TmdbNetworkImagesResponseDto>(`/network/${networkId}/images`);
    }
}