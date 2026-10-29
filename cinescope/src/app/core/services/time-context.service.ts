import { Injectable, signal, computed, DestroyRef, inject } from '@angular/core';

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'late_night';

export interface TimeOfDayContext {
  period: TimePeriod;
  badge: string;
  badgeIcon: string;
  headline: string;
  subtitle: string;
  cardTag: string;
  actionLabel: string;
  sectionTitle: string;
}

export function resolveTimeOfDayContext(now: Date = new Date()): TimeOfDayContext {
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      period: 'morning',
      badge: 'Morning Cinema',
      badgeIcon: 'sunny-outline',
      headline: 'WHAT SHOULD I WATCH THIS MORNING?',
      subtitle: 'Start your day with an inspiring pick from your Watchlist',
      cardTag: "THIS MORNING'S FEATURED PICK",
      actionLabel: 'Watch This Morning',
      sectionTitle: "This Morning's Pick"
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      period: 'afternoon',
      badge: 'Afternoon Matinee',
      badgeIcon: 'film-outline',
      headline: 'WHAT SHOULD I WATCH THIS AFTERNOON?',
      subtitle: 'A curated matinee feature from your Watchlist',
      cardTag: 'AFTERNOON MATINEE PICK',
      actionLabel: 'Watch This Afternoon',
      sectionTitle: 'Afternoon Matinee Pick'
    };
  }

  if (hour >= 17 && hour < 22) {
    return {
      period: 'evening',
      badge: 'Prime Time Cinema',
      badgeIcon: 'sparkles',
      headline: 'WHAT SHOULD I WATCH TONIGHT?',
      subtitle: 'Instant curated pick tailored to your mood from your Watchlist',
      cardTag: "TONIGHT'S FEATURED PICK",
      actionLabel: 'Watch Tonight',
      sectionTitle: "Tonight's Pick"
    };
  }

  return {
    period: 'late_night',
    badge: 'Late-Night Screening',
    badgeIcon: 'moon-outline',
    headline: 'WHAT SHOULD I WATCH LATE NIGHT?',
    subtitle: 'Quiet nocturnal cinema & midnight gems from your Watchlist',
    cardTag: 'MIDNIGHT SCREENING PICK',
    actionLabel: 'Watch Late Night',
    sectionTitle: 'Late-Night Pick'
  };
}

@Injectable({
  providedIn: 'root'
})
export class TimeContextService {
  private readonly destroyRef = inject(DestroyRef, { optional: true });
  private readonly currentTime = signal<Date>(new Date());

  public readonly context = computed<TimeOfDayContext>(() =>
    resolveTimeOfDayContext(this.currentTime())
  );

  public readonly period = computed<TimePeriod>(() => this.context().period);
  public readonly headline = computed<string>(() => this.context().headline);
  public readonly cardTag = computed<string>(() => this.context().cardTag);
  public readonly actionLabel = computed<string>(() => this.context().actionLabel);
  public readonly sectionTitle = computed<string>(() => this.context().sectionTitle);

  constructor() {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const onVisibilityChange = (): void => {
        if (document.visibilityState === 'visible') {
          this.refresh();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      this.destroyRef?.onDestroy(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      });
    }
  }

  public refresh(customDate?: Date): void {
    this.currentTime.set(customDate ?? new Date());
  }
}
