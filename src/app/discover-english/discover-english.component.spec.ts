import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverEnglishComponent } from './discover-english.component';

describe('DiscoverEnglishComponent', () => {
  let component: DiscoverEnglishComponent;
  let fixture: ComponentFixture<DiscoverEnglishComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverEnglishComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverEnglishComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
