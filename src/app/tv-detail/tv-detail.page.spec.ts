import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TvDetailPage } from './tv-detail.page';

describe('TvDetailPage', () => {
  let component: TvDetailPage;
  let fixture: ComponentFixture<TvDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TvDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
