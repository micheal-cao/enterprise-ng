import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { IdsDropdownComponent } from './ids-dropdown.component';

describe('IdsDropdownComponent', () => {
  let component: IdsDropdownComponent;
  let fixture: ComponentFixture<IdsDropdownComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ IdsDropdownComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IdsDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
