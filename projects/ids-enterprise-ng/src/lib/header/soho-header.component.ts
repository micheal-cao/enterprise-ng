/// <reference path="soho-header.d.ts" />

import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'soho-header',
  templateUrl: './soho-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SohoHeaderComponent implements AfterViewChecked, AfterViewInit {
  @HostBinding('class.header') get isHeader() { return true; }
  @HostBinding('class.is-personalizable') get isPersonalizable() { return true; }
  @HostBinding('class.has-toolbar') @Input() hasToolbar;
  @HostBinding('class.has-tabs') @Input() hasTabs;

  /**
   * Set a boolean that determines whether or not to use a Flex Toolbar internally.
   * If true, Flex Toolbar will replace the Standard Toolbar.
   */
  @Input() set useFlexToolbar(value: boolean) {
    this.options.useFlexToolbar = value;
    this.headerChanged = true;
  }

  /**
   * Passes an object to the IDS Header Component that defines settings for the
   * internal Toolbar or Flex Toolbar.
   */
  @Input() set toolbarSettings(value: SohoToolbarOptions|SohoToolbarFlexOptions) {
    this.options.toolbarSettings = value;
    this.headerChanged = true;
  }

  /**
   * This event is fired when the status of the header is changed.
   */
  @Output() updated = new EventEmitter<any>();

  // Reference to the jQuery element.
  private jQueryElement: JQuery;

  // Reference to the annotated IDS Component
  private header: SohoHeaderStatic;
  private options: SohoHeaderOptions = {};

  // Internally used for state management
  private headerChanged: boolean;

  constructor(private elementRef: ElementRef) {}

  /**
   * Used to manually remove the back button when
   * Which is used in the header via the list/detail pattern
   */
  removeBackButton() {
    this.header.removeBackButton();
  }

  ngAfterViewInit() {
    // Wrap for later.
    this.jQueryElement = jQuery(this.elementRef.nativeElement);

    // Initialise the SoHoXi control.
    this.jQueryElement.header(this.options);

    // Once the control is initialised, extract the control
    // plug-in from the element.  The element name is
    // defined by the plug-in, but in this case is 'sohoxiHeader'.
    this.header = this.jQueryElement.data('header');

    // Initialize any event handlers.
    this.jQueryElement.on('updated', (e: JQuery.TriggeredEvent, args: any) => { this.updated.emit(args); });
  }

  ngAfterViewChecked() {
    if (this.headerChanged) {
      this.header.updated(this.options);
      this.headerChanged = false;
    }
  }
}
