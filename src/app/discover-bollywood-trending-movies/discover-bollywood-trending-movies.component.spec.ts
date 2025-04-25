import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverBollywoodTrendingMoviesComponent } from './discover-bollywood-trending-movies.component';

describe('DiscoverBollywoodTrendingMoviesComponent', () => {
  let component: DiscoverBollywoodTrendingMoviesComponent;
  let fixture: ComponentFixture<DiscoverBollywoodTrendingMoviesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverBollywoodTrendingMoviesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverBollywoodTrendingMoviesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
