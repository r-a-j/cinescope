import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopRatedTvPage } from './top-rated-tv.page';

describe('TopRatedTvPage', () => {
  let component: TopRatedTvPage;
  let fixture: ComponentFixture<TopRatedTvPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TopRatedTvPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
