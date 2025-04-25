import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverTopRatedForeignTvComponent } from './discover-top-rated-foreign-tv.component';

describe('DiscoverTopRatedForeignTvComponent', () => {
  let component: DiscoverTopRatedForeignTvComponent;
  let fixture: ComponentFixture<DiscoverTopRatedForeignTvComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverTopRatedForeignTvComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverTopRatedForeignTvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
