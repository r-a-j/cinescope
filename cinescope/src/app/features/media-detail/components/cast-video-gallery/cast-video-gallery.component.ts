import { Component, ChangeDetectionStrategy, input, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IonIcon, Platform } from '@ionic/angular/standalone';
import { TmdbVideoDto } from '../../../../core/dtos/common/video.dto';
import { CastMemberVm } from '../../media-detail.page';

@Component({
  selector: 'app-cast-video-gallery',
  standalone: true,
  imports: [CommonModule, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cast-video-gallery.component.html',
  styleUrls: ['./cast-video-gallery.component.scss'],
})
export class CastVideoGalleryComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private router = inject(Router);
  private platform = inject(Platform);
  private backButtonSub: (() => void) | null = null;

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

  public openPerson(actor: CastMemberVm): void {
    void this.router.navigate(['/person', actor.id], {
      state: {
        preview: {
          id: actor.id,
          name: actor.name,
          profileUrl: actor.profileUrl,
          knownForDepartment: 'Acting'
        }
      }
    });
  }

  public openVideo(video: TmdbVideoDto): void {
    this.activeVideo.set(video);
    if (!this.backButtonSub) {
      const sub = this.platform.backButton.subscribeWithPriority(9999, (): void => {
        this.closeVideo();
      });
      this.backButtonSub = (): void => sub.unsubscribe();
    }
  }

  public closeVideo(): void {
    this.activeVideo.set(null);
    if (this.backButtonSub) {
      this.backButtonSub();
      this.backButtonSub = null;
    }
  }

  ngOnDestroy(): void {
    if (this.backButtonSub) {
      this.backButtonSub();
      this.backButtonSub = null;
    }
  }
}
