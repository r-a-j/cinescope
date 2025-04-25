import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverBollywoodUpcomingMoviesComponent } from './discover-bollywood-upcoming-movies.component';

describe('DiscoverBollywoodUpcomingMoviesComponent', () => {
  let component: DiscoverBollywoodUpcomingMoviesComponent;
  let fixture: ComponentFixture<DiscoverBollywoodUpcomingMoviesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverBollywoodUpcomingMoviesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverBollywoodUpcomingMoviesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
