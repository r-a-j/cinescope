import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverTopRatedComponent } from './discover-top-rated.component';

describe('DiscoverTopRatedComponent', () => {
  let component: DiscoverTopRatedComponent;
  let fixture: ComponentFixture<DiscoverTopRatedComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverTopRatedComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverTopRatedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
