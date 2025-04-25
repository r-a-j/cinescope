import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverTopRatedDesiTvComponent } from './discover-top-rated-desi-tv.component';

describe('DiscoverTopRatedDesiTvComponent', () => {
  let component: DiscoverTopRatedDesiTvComponent;
  let fixture: ComponentFixture<DiscoverTopRatedDesiTvComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverTopRatedDesiTvComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverTopRatedDesiTvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
