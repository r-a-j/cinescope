import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverActorsComponent } from './discover-actors.component';

describe('DiscoverActorsComponent', () => {
  let component: DiscoverActorsComponent;
  let fixture: ComponentFixture<DiscoverActorsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverActorsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverActorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
