import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverTopRatedForeignMoviesComponent } from './discover-top-rated-foreign-movies.component';

describe('DiscoverTopRatedForeignMoviesComponent', () => {
  let component: DiscoverTopRatedForeignMoviesComponent;
  let fixture: ComponentFixture<DiscoverTopRatedForeignMoviesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverTopRatedForeignMoviesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverTopRatedForeignMoviesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
