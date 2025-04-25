import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverActorsPopularComponent } from './discover-actors-popular.component';

describe('DiscoverActorsPopularComponent', () => {
  let component: DiscoverActorsPopularComponent;
  let fixture: ComponentFixture<DiscoverActorsPopularComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverActorsPopularComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverActorsPopularComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
