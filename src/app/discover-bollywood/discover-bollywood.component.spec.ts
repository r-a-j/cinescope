import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DiscoverBollywoodComponent } from './discover-bollywood.component';

describe('DiscoverBollywoodComponent', () => {
  let component: DiscoverBollywoodComponent;
  let fixture: ComponentFixture<DiscoverBollywoodComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DiscoverBollywoodComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverBollywoodComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
