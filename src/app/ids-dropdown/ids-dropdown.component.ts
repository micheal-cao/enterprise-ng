import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-ids-dropdown',
  templateUrl: './ids-dropdown.component.html',
  styleUrls: ['./ids-dropdown.component.css']
})
export class IdsDropdownComponent implements OnInit {
  public open = false;

  constructor() { }

  ngOnInit() {
  }

  toggleMenu() {
    this.open = !this.open;
  }

}
