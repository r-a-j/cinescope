import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonDetailPage } from './person-detail.page';

describe('PersonDetailPage', () => {
  let component: PersonDetailPage;
  let fixture: ComponentFixture<PersonDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PersonDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
