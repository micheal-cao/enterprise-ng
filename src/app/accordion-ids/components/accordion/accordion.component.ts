import { Component, OnInit, AfterContentInit, ContentChildren, QueryList, Input } from '@angular/core';
import { AccordionGroupComponent } from '../accordion-group/accordion-group.component';
import { Subject } from 'rxjs';


@Component({
  selector: 'ids-accordion',
  templateUrl: './accordion.component.html',
  styleUrls: ['./accordion.component.css'],
})
export class AccordionComponent implements AfterContentInit {
  @ContentChildren(AccordionGroupComponent) groups: QueryList<AccordionGroupComponent>;
  @Input() expandAll: Subject<any>;
  @Input() collapseAll: Subject<any>;
  @Input() allowOnePanel: boolean;
  @Input() allowToggle: boolean;

  constructor() { }

  ngAfterContentInit() {

    this.groups.toArray()[0].expanded = true;

    if (this.allowOnePanel) {
      this.groups.toArray().forEach(t => {
        t.toggle.subscribe(() => {
          this.expandGroupAllowOnePanel(t);
        });
      });
    }

    if (!this.allowOnePanel) {
      this.groups.toArray().forEach(t => {
        t.toggle.subscribe(() => {
          this.expandGroupAllowAllPanels(t);
        });
      });
    }

    this.expandAll.subscribe(event => {
      console.log(event);
      this.groups.toArray().forEach((t) => t.expanded = true);
    });

    this.collapseAll.subscribe(event => {
      console.log(event);
      this.groups.toArray().forEach((t) => t.expanded = false);
    })
  }

  expandGroupAllowOnePanel(group: any) {
    this.groups.toArray().forEach((t) => t !== group ? t.expanded = false : group.expanded = !group.expanded);
  }

  expandGroupAllowAllPanels(group: any) {
    group.expanded = !group.expanded;
  }

}
