import { Component, OnInit, ViewChild, QueryList, ContentChildren } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-accordion-ids',
  templateUrl: './accordion-ids.component.html',
})
export class AccordionIdsComponent implements OnInit {
  public expandAllSubject: Subject<any> = new Subject();
  public collapseAllSubject: Subject<any> = new Subject();

  constructor() { }

  ngOnInit() { }

  ngAfterContentInit() { }

  expandAllPanels() {
    this.expandAllSubject.next('Expand All');
  }

  collapseAllPanels() {
    this.collapseAllSubject.next('Collapse All');
  }
}
