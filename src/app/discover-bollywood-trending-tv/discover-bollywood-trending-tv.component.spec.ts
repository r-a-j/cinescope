import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverBollywoodTrendingTvComponent } from './discover-bollywood-trending-tv.component';

describe('DiscoverBollywoodTrendingTvComponent', () => {
  let component: DiscoverBollywoodTrendingTvComponent;
  let fixture: ComponentFixture<DiscoverBollywoodTrendingTvComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverBollywoodTrendingTvComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverBollywoodTrendingTvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
