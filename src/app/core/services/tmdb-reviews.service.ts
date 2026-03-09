import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TmdbReviewDetailDto } from '../dtos/reviews/review-detail.dto';
import { BaseMediaService } from './base-media.service';

@Injectable({ providedIn: 'root' })
export class TmdbReviewsService extends BaseMediaService {
    /**
     * Retrieve the details of a specific movie or TV show review.
     * * @productContext
     * - Scenario 30 (The "What Did I Just Watch?"): If a user finishes a confusing movie (like Mulholland Drive), use this endpoint to deep-link them directly to a specific, highly-rated community review that explains the ending.
     * The Problem: The credits roll on *Mulholland Drive* or *Inception*. You are incredibly confused and need someone to explain it to you immediately.
     * The Feature: "The 'WTF Just Happened' Button." Appears only on movies flagged as 'Mind-benders'. One tap instantly pulls up the top Reddit explanation threads and verified YouTube breakdown videos.
     * - Scenario 73 (The "Departure Log"): Users can share direct links to their long-form reviews detailing the differences between a book and a movie adaptation. This endpoint resolves that shared link.
     * The Problem: You just watched an adaptation of a book you love, and you want to know exactly what the director changed.
     * The Feature: "The Departure Log." A specialized review section where users can vote on and summarize the biggest differences between the source material and the screen, categorized by "Major Plot Changes" and "Character Changes."
     * * @param reviewId The unique TMDB Review ID (Note: This is a string, e.g., '640b2aeecaaca20079decdcc').
     * 
     * Pro-Tip for CINESCOPE
     * Because the review ID is a long string hash (e.g., 640b2aeecaaca20079decdcc), it is perfect for Deep Linking and Social Sharing.
     * If a user writes a brilliant review on CINESCOPE (or you surface one from TMDB), they can hit a "Share" button. Your app generates a link like cinescope.app/review/640b2aeecaaca20079decdcc. When a friend taps that link on their phone, the CINESCOPE app opens, reads the ID from the URL, calls this exact getReviewDetails method, and renders a beautiful, full-screen reading experience with the media_title pinned to the top.
     */
    getReviewDetails(reviewId: string): Observable<TmdbReviewDetailDto> {
        return this.http.get<TmdbReviewDetailDto>(`${this.apiPrefix}/review/${reviewId}`);
    }
}