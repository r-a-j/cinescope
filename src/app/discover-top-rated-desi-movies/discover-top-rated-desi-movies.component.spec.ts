import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverTopRatedDesiMoviesComponent } from './discover-top-rated-desi-movies.component';

describe('DiscoverTopRatedDesiMoviesComponent', () => {
  let component: DiscoverTopRatedDesiMoviesComponent;
  let fixture: ComponentFixture<DiscoverTopRatedDesiMoviesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverTopRatedDesiMoviesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverTopRatedDesiMoviesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
