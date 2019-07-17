import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { trigger, style, animate, transition, state } from '@angular/animations';
import { Subject } from 'rxjs';

@Component({
  selector: 'ids-accordion-group',
  templateUrl: './accordion-group.component.html',
  styleUrls: ['./accordion-group.component.css'],
  animations: [
    trigger('slideUpDown', [
      state('0', style({
        height: '0',
        overflow: 'hidden'
      })),
      state('1', style({
        height: '*',
        overflow: 'hidden'
      })),
      transition('0 => 1', animate(200)),
      transition('1 => 0', animate(200)),
    ])
  ]
})
export class AccordionGroupComponent implements OnInit {
  @Input() expanded = false;
  @Input() title: string;
  @Input() hasChevron = true;
  @Output() toggle: EventEmitter<any> = new EventEmitter<any>();

  constructor() { }

  ngOnInit() {
  }

}
