import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Platform } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { AppTourStep } from '../../../core/constants/app-tour.constants';
import { AppTourService } from '../../../core/services/app-tour.service';
import { AppTourOverlayComponent } from './app-tour-overlay.component';

describe('AppTourOverlayComponent accessibility', () => {
  let fixture: ComponentFixture<AppTourOverlayComponent>;
  let tour: {
    isActive: ReturnType<typeof signal<boolean>>;
    isNavigating: ReturnType<typeof signal<boolean>>;
    currentStep: ReturnType<typeof signal<AppTourStep | null>>;
    currentStepNumber: ReturnType<typeof signal<number>>;
    totalSteps: ReturnType<typeof signal<number>>;
    canGoBack: ReturnType<typeof signal<boolean>>;
    next: jasmine.Spy;
    previous: jasmine.Spy;
    skip: jasmine.Spy;
  };
  let outlet: HTMLElement;
  let initialFocus: HTMLButtonElement;

  beforeEach(async () => {
    tour = {
      isActive: signal(false),
      isNavigating: signal(false),
      currentStep: signal<AppTourStep | null>(null),
      currentStepNumber: signal(1),
      totalSteps: signal(1),
      canGoBack: signal(false),
      next: jasmine.createSpy('next').and.resolveTo(),
      previous: jasmine.createSpy('previous').and.resolveTo(),
      skip: jasmine.createSpy('skip').and.resolveTo()
    };
    outlet = document.createElement('ion-router-outlet');
    initialFocus = document.createElement('button');
    initialFocus.textContent = 'Open tutorial';
    document.body.append(outlet, initialFocus);
    initialFocus.focus();

    await TestBed.configureTestingModule({
      imports: [AppTourOverlayComponent],
      providers: [
        provideRouter([]),
        { provide: AppTourService, useValue: tour },
        {
          provide: Platform,
          useValue: { backButton: { subscribeWithPriority: (): Subscription => new Subscription() } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppTourOverlayComponent);
  });

  afterEach(() => {
    fixture.destroy();
    outlet.remove();
    initialFocus.remove();
  });

  async function activateTour(): Promise<void> {
    const target = document.createElement('button');
    target.dataset['tour'] = 'test-target';
    target.textContent = 'Target';
    target.style.width = '80px';
    target.style.height = '40px';
    document.body.append(target);

    tour.currentStep.set({
      route: '/test',
      target: 'test-target',
      title: 'Test tutorial',
      description: 'Tutorial description'
    });
    tour.isActive.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    target.remove();
  }

  it('moves focus into the dialog, hides the app content, and restores focus on close', async () => {
    await activateTour();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
    expect(outlet.inert).toBeTrue();
    expect(outlet.getAttribute('aria-hidden')).toBe('true');

    tour.isActive.set(false);
    fixture.detectChanges();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    expect(outlet.inert).toBeFalse();
    expect(outlet.hasAttribute('aria-hidden')).toBeFalse();
    expect(document.activeElement).toBe(initialFocus);
  });

  it('keeps Tab navigation inside the tutorial dialog', async () => {
    await activateTour();

    const closeButton = fixture.nativeElement.querySelector('.tour-close') as HTMLButtonElement;
    closeButton.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
      shiftKey: true
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(document.activeElement?.textContent?.trim()).toBe('Finish');
  });
});
