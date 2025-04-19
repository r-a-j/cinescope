import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopRatedMoviesPage } from './top-rated-movies.page';

describe('TopRatedMoviesPage', () => {
  let component: TopRatedMoviesPage;
  let fixture: ComponentFixture<TopRatedMoviesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TopRatedMoviesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
