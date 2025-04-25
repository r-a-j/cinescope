import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverBollywoodUpcomingTvComponent } from './discover-bollywood-upcoming-tv.component';

describe('DiscoverBollywoodUpcomingTvComponent', () => {
  let component: DiscoverBollywoodUpcomingTvComponent;
  let fixture: ComponentFixture<DiscoverBollywoodUpcomingTvComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverBollywoodUpcomingTvComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverBollywoodUpcomingTvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
