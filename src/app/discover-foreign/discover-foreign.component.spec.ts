import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverForeignComponent } from './discover-foreign.component';

describe('DiscoverForeignComponent', () => {
  let component: DiscoverForeignComponent;
  let fixture: ComponentFixture<DiscoverForeignComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverForeignComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverForeignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
