import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverTrendingComponent } from './discover-trending.component';

describe('DiscoverTrendingComponent', () => {
  let component: DiscoverTrendingComponent;
  let fixture: ComponentFixture<DiscoverTrendingComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverTrendingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverTrendingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
