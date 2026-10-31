import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TmdbSearchService, TmdbMultiSearchResultDto } from './tmdb-search.service';
import { StorageService, TmdbPayload } from './storage.service';

export interface ExtractedTitleItem {
  title: string;
  year?: number;
  mediaType?: 'movie' | 'tv';
}

export interface IngestionResult {
  added: number;
  skipped: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExtractionService {
  private readonly http = inject(HttpClient);
  private readonly tmdbSearch = inject(TmdbSearchService);
  private readonly storage = inject(StorageService);
  private readonly extractUrl = `${environment.apiUrl}/extract`;

  /**
   * Calls the multimodal BFF Gateway to extract movie and TV titles from text or image.
   */
  public extractTitles(payload: {
    text?: string;
    image?: string;
    mimeType?: string;
  }): Observable<ExtractedTitleItem[]> {
    let cleanImage = payload.image;
    let cleanMime = payload.mimeType;

    if (cleanImage) {
      const commaIdx = cleanImage.indexOf(',');
      if (cleanImage.startsWith('data:') && commaIdx !== -1) {
        const header = cleanImage.substring(0, commaIdx);
        const match = header.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64$/i);
        if (match) {
          cleanMime = match[1].toLowerCase().trim();
        }
        cleanImage = cleanImage.substring(commaIdx + 1);
      }
      cleanImage = cleanImage.replace(/[\r\n\s]+/g, '');
    }

    return this.http.post<ExtractedTitleItem[]>(this.extractUrl, {
      ...payload,
      ...(cleanImage ? { image: cleanImage } : {}),
      ...(cleanMime ? { mimeType: cleanMime } : {})
    });
  }

  /**
   * Enriches each extracted title against TMDB and queues candidates into the Inbox.
   * If a title is already in Watchlist or Watched, it counts as skipped to prevent clutter.
   * If TMDB returns no candidate, a clean fallback item is created so no title is lost.
   */
  public async resolveAndQueueTitles(titles: ExtractedTitleItem[]): Promise<IngestionResult> {
    let added = 0;
    let skipped = 0;

    for (const item of titles) {
      const cleanTitle = item.title?.trim();
      if (!cleanTitle) continue;

      try {
        const searchRes = await firstValueFrom(this.tmdbSearch.searchMulti(cleanTitle, 1));
        const results = searchRes?.results || [];

        // Filter out people, keep only movies and TV shows
        const mediaCandidates = results.filter(
          (r): r is (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' }) =>
            r.media_type === 'movie' || r.media_type === 'tv'
        );

        const bestMatch = this.pickBestCandidate(cleanTitle, mediaCandidates, item);

        if (bestMatch) {
          const isTv = bestMatch.media_type === 'tv';
          const title = isTv ? bestMatch.name : bestMatch.title;
          const payload: TmdbPayload = {
            id: bestMatch.id,
            title: title || cleanTitle,
            name: isTv ? bestMatch.name : undefined,
            poster_path: bestMatch.poster_path,
            backdrop_path: bestMatch.backdrop_path,
            vote_average: bestMatch.vote_average,
            release_date: !isTv ? bestMatch.release_date : undefined,
            first_air_date: isTv ? bestMatch.first_air_date : undefined,
            overview: bestMatch.overview || '',
            genre_ids: bestMatch.genre_ids
          };

          const wasAdded = await this.storage.addToInbox(bestMatch.id, bestMatch.media_type, payload);
          if (wasAdded) {
            added++;
          } else {
            skipped++;
          }
        } else {
          // Fallback: TMDB search returned 0 matches, create fallback doc so user title is preserved
          const fallbackMediaType: 'movie' | 'tv' = item.mediaType || 'movie';
          const syntheticId = this.generateSyntheticId(cleanTitle);
          const fallbackPayload: TmdbPayload = {
            id: syntheticId,
            title: cleanTitle,
            overview: 'Imported via CineScope AI extraction queue.',
            release_date: item.year ? `${item.year}-01-01` : undefined,
            first_air_date: item.year ? `${item.year}-01-01` : undefined
          };

          const wasAdded = await this.storage.addToInbox(syntheticId, fallbackMediaType, fallbackPayload);
          if (wasAdded) {
            added++;
          } else {
            skipped++;
          }
        }
      } catch (searchError) {
        console.warn(`[ExtractionService] Failed to resolve TMDB for "${cleanTitle}":`, searchError);
        // Fallback on error
        const fallbackMediaType: 'movie' | 'tv' = item.mediaType || 'movie';
        const syntheticId = this.generateSyntheticId(cleanTitle);
        const fallbackPayload: TmdbPayload = {
          id: syntheticId,
          title: cleanTitle,
          overview: 'Imported title.'
        };
        const wasAdded = await this.storage.addToInbox(syntheticId, fallbackMediaType, fallbackPayload);
        if (wasAdded) {
          added++;
        } else {
          skipped++;
        }
      }
    }

    return {
      added,
      skipped,
      total: titles.length
    };
  }

  /**
   * Scales down large smartphone screenshots client-side to ensure the base64 payload
   * remains well below Vercel's 4.5MB request body size threshold.
   */
  public compressImage(file: File, maxDimension = 1280, quality = 0.82): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = (): void => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          base64: dataUrl,
          mimeType: 'image/jpeg'
        });
      };

      img.onerror = (): void => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to decode image file'));
      };

      img.src = objectUrl;
    });
  }

  private pickBestCandidate(
    title: string,
    candidates: (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' })[],
    hint: ExtractedTitleItem
  ): (TmdbMultiSearchResultDto & { media_type: 'movie' | 'tv' }) | null {
    if (candidates.length === 0) return null;

    const normalizedTarget = title.trim().toLowerCase();
    const compatibleCandidates = candidates.filter((candidate) => {
      if (hint.mediaType && candidate.media_type !== hint.mediaType) return false;

      if (hint.year !== undefined) {
        const date = candidate.media_type === 'tv' ? candidate.first_air_date : candidate.release_date;
        const candidateYear = date ? Number.parseInt(date.slice(0, 4), 10) : undefined;
        if (candidateYear !== hint.year) return false;
      }

      return true;
    });
    if (compatibleCandidates.length === 0) return null;

    return compatibleCandidates.find((candidate) => {
      const candidateTitle = (candidate.media_type === 'tv' ? candidate.name : candidate.title)
        ?.trim()
        .toLowerCase();
      return candidateTitle === normalizedTarget;
    }) || compatibleCandidates[0];
  }

  private generateSyntheticId(title: string): number {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash << 5) - hash + title.charCodeAt(i);
      hash |= 0;
    }
    return 900000000 + (Math.abs(hash) % 99999999);
  }
}
