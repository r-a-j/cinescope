import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let component: EmptyStateComponent;
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('icon', 'film-outline');
    fixture.componentRef.setInput('title', 'YOUR WATCHLIST IS EMPTY');
    fixture.componentRef.setInput('description', 'Explore movies and series on Discover.');
    fixture.detectChanges();
  });

  it('should render title, description, and icon', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-title')?.textContent).toContain('YOUR WATCHLIST IS EMPTY');
    expect(el.querySelector('.empty-description')?.textContent).toContain('Explore movies and series on Discover.');
    expect(el.querySelector('.empty-icon-ring ion-icon')).toBeTruthy();
  });

  it('should render optional kicker and CTA button and emit actionClick when clicked', () => {
    fixture.componentRef.setInput('kicker', 'CINEMA COMMAND CENTER');
    fixture.componentRef.setInput('actionLabel', 'Explore on Discover');
    fixture.componentRef.setInput('actionIcon', 'sparkles');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-kicker')?.textContent).toBe('CINEMA COMMAND CENTER');

    const btn = el.querySelector('.empty-cta-btn') as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toContain('Explore on Discover');

    spyOn(component.actionClick, 'emit');
    btn?.click();
    expect(component.actionClick.emit).toHaveBeenCalled();
  });
});
