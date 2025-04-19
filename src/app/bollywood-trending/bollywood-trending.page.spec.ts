import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BollywoodTrendingPage } from './bollywood-trending.page';

describe('BollywoodTrendingPage', () => {
  let component: BollywoodTrendingPage;
  let fixture: ComponentFixture<BollywoodTrendingPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BollywoodTrendingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
