import { Component, ChangeDetectionStrategy, input, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IonIcon } from '@ionic/angular/standalone';
import { TmdbVideoDto } from '../../../../core/dtos/common/video.dto';
import { CastMemberVm } from '../../media-detail.page';

@Component({
  selector: 'app-cast-video-gallery',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- TOP BILLED CAST CAROUSEL -->
    @if (castList().length > 0) {
      <section class="detail-section">
        <h3 class="section-heading">TOP BILLED CAST ({{ castList().length }})</h3>
        <div class="cast-scroll-row">
          @for (actor of castList(); track actor.id) {
            <div class="cast-card">
              <div class="cast-avatar-wrap">
                <img
                  [src]="actor.profileUrl"
                  [alt]="actor.name"
                  class="cast-avatar"
                  loading="lazy"
                  decoding="async" />
                @if (actor.episodeCount) {
                  <span class="cast-ep-badge">{{ actor.episodeCount }} eps</span>
                }
              </div>
              <div class="cast-name">{{ actor.name }}</div>
              <div class="cast-character">{{ actor.character }}</div>
            </div>
          }
        </div>
      </section>
    }

    <!-- TRAILERS, TEASERS & FEATURETTES -->
    @if (videos().length > 0) {
      <section class="detail-section">
        <h3 class="section-heading">VIDEOS, TRAILERS & FEATURETTES ({{ videos().length }})</h3>
        <div class="videos-scroll-row">
          @for (vid of videos().slice(0, 12); track vid.id) {
            <button type="button" class="video-thumb-card" (click)="openVideo(vid)">
              <div class="video-thumb-img-wrap">
                <img
                  [src]="'https://img.youtube.com/vi/' + vid.key + '/hqdefault.jpg'"
                  [alt]="vid.name"
                  class="video-thumb-img"
                  loading="lazy" />
                <div class="video-play-overlay">
                  <ion-icon name="play-outline"></ion-icon>
                </div>
                <span class="video-type-tag">{{ vid.type }}</span>
                @if (vid.official) {
                  <span class="video-official-tag">OFFICIAL</span>
                }
              </div>
              <div class="video-title">{{ vid.name }}</div>
            </button>
          }
        </div>
      </section>
    }

    <!-- Embedded YouTube Trailer Modal -->
    @if (activeVideo(); as vid) {
      <div
        class="video-modal-backdrop"
        tabindex="0"
        (click)="closeVideo()"
        (keyup.escape)="closeVideo()">
        <div
          class="video-modal-sheet"
          tabindex="0"
          (click)="$event.stopPropagation()"
          (keyup.enter)="$event.stopPropagation()">
          <div class="video-modal-header">
            <div class="video-modal-title">{{ vid.name }}</div>
            <button type="button" class="modal-close-btn" (click)="closeVideo()">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>

          @if (activeVideoEmbedUrl(); as safeUrl) {
            <div class="video-iframe-container">
              <iframe
                [src]="safeUrl"
                title="YouTube video player"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            </div>
          }

          <div class="video-modal-footer">
            <a
              [href]="'https://www.youtube.com/watch?v=' + vid.key"
              target="_blank"
              rel="noopener noreferrer"
              class="yt-external-btn">
              Open in YouTube App <ion-icon name="open-outline"></ion-icon>
            </a>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .detail-section {
      padding: 20px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .section-heading {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
    }
    .cast-scroll-row,
    .videos-scroll-row {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 6px;
      scrollbar-width: none;
    }
    .cast-scroll-row::-webkit-scrollbar,
    .videos-scroll-row::-webkit-scrollbar {
      display: none;
    }
    .cast-card {
      width: 98px;
      min-width: 98px;
      display: flex;
      flex-direction: column;
    }
    .cast-avatar-wrap {
      position: relative;
      width: 98px;
      height: 128px;
      border-radius: 10px;
      overflow: hidden;
      background: #16161c;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .cast-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cast-ep-badge {
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.82);
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .cast-name {
      margin-top: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cast-character {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.56);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .video-thumb-card {
      width: 214px;
      min-width: 214px;
      background: none;
      border: none;
      padding: 0;
      text-align: left;
      color: #ffffff;
      cursor: pointer;
    }
    .video-thumb-img-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: 10px;
      overflow: hidden;
      background: #141418;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .video-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .video-play-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .video-play-overlay ion-icon {
      font-size: 34px;
      color: #ffffff;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.7));
    }
    .video-type-tag {
      position: absolute;
      bottom: 6px;
      left: 6px;
      background: rgba(0, 0, 0, 0.82);
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .video-official-tag {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(16, 185, 129, 0.9);
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .video-title {
      margin-top: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.88);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .video-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(0, 0, 0, 0.86);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .video-modal-sheet {
      width: 100%;
      max-width: 640px;
      border-radius: 16px;
      background: #121217;
      border: 1px solid rgba(255, 255, 255, 0.14);
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9);
    }
    .video-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .video-modal-title {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .modal-close-btn {
      background: none;
      border: none;
      color: #ffffff;
      font-size: 24px;
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    .video-iframe-container {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000000;
    }
    .video-iframe-container iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }
    .video-modal-footer {
      padding: 12px 16px;
      display: flex;
      justify-content: flex-end;
    }
    .yt-external-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      font-weight: 700;
      color: #ff4d57;
      text-decoration: none;
    }
  `]
})
export class CastVideoGalleryComponent {
  private sanitizer = inject(DomSanitizer);

  public castList = input.required<CastMemberVm[]>();
  public videos = input.required<TmdbVideoDto[]>();

  public activeVideo = signal<TmdbVideoDto | null>(null);

  public activeVideoEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const vid = this.activeVideo();
    if (!vid || vid.site !== 'YouTube') return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${vid.key}?autoplay=1&rel=0&modestbranding=1`
    );
  });

  public openVideo(video: TmdbVideoDto): void {
    this.activeVideo.set(video);
  }

  public closeVideo(): void {
    this.activeVideo.set(null);
  }
}
