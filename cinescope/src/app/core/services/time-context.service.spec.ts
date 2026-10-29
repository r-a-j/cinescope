import { TestBed } from '@angular/core/testing';
import { TimeContextService, resolveTimeOfDayContext } from './time-context.service';

describe('TimeContextService', () => {
  let service: TimeContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeContextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should resolve morning context between 05:00 and 11:59', () => {
    const morning = new Date(2026, 9, 29, 8, 30, 0);
    const ctx = resolveTimeOfDayContext(morning);
    expect(ctx.period).toBe('morning');
    expect(ctx.headline).toBe('WHAT SHOULD I WATCH THIS MORNING?');
    expect(ctx.cardTag).toBe("THIS MORNING'S FEATURED PICK");
    expect(ctx.actionLabel).toBe('Watch This Morning');
  });

  it('should resolve afternoon context between 12:00 and 16:59', () => {
    const afternoon = new Date(2026, 9, 29, 14, 15, 0);
    const ctx = resolveTimeOfDayContext(afternoon);
    expect(ctx.period).toBe('afternoon');
    expect(ctx.headline).toBe('WHAT SHOULD I WATCH THIS AFTERNOON?');
    expect(ctx.cardTag).toBe('AFTERNOON MATINEE PICK');
    expect(ctx.actionLabel).toBe('Watch This Afternoon');
  });

  it('should resolve evening context between 17:00 and 21:59', () => {
    const evening = new Date(2026, 9, 29, 19, 45, 0);
    const ctx = resolveTimeOfDayContext(evening);
    expect(ctx.period).toBe('evening');
    expect(ctx.headline).toBe('WHAT SHOULD I WATCH TONIGHT?');
    expect(ctx.cardTag).toBe("TONIGHT'S FEATURED PICK");
    expect(ctx.actionLabel).toBe('Watch Tonight');
  });

  it('should resolve late_night context between 22:00 and 04:59', () => {
    const lateNight = new Date(2026, 9, 29, 23, 30, 0);
    const ctx = resolveTimeOfDayContext(lateNight);
    expect(ctx.period).toBe('late_night');
    expect(ctx.headline).toBe('WHAT SHOULD I WATCH LATE NIGHT?');
    expect(ctx.cardTag).toBe('MIDNIGHT SCREENING PICK');
    expect(ctx.actionLabel).toBe('Watch Late Night');
  });

  it('should reactively update signals when refresh is called with a custom date', () => {
    service.refresh(new Date(2026, 9, 29, 7, 30, 0));
    expect(service.period()).toBe('morning');
    expect(service.actionLabel()).toBe('Watch This Morning');

    service.refresh(new Date(2026, 9, 29, 20, 0, 0));
    expect(service.period()).toBe('evening');
    expect(service.actionLabel()).toBe('Watch Tonight');
  });
});
