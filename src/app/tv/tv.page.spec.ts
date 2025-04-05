import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TvPage } from './tv.page';

describe('Tab2Page', () => {
  let component: TvPage;
  let fixture: ComponentFixture<TvPage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TvPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
