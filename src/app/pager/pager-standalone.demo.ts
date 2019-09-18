import { Component } from '@angular/core';

@Component({
  selector: 'demo-pager-standalone-demo',
  templateUrl: './pager-standalone.demo.html',
})
export class PagerStandaloneDemoComponent {

  model = {
    hideFirstButton: false,
    hidePreviousButton: false,
    hideNextButton: false,
    hideLastButton: false,

    disableFirstButton: false,
    disableLastButton: false,
    disablePreviousButton: false,
    disableNextButton: false,

    firstPageTooltip: 'click to got to the first page of records',
    lastPageTooltip: 'click to got to the last page of records',
    previousPageTooltip: 'click to got to the previous page of records',
    nextPageTooltip: 'click to got to the last page of records',

    hidePageSizeSelector: false,
    pageSizeMenuSettings: { attachToBody: false },

    pageSize: 10,
    pageSizes: [5, 10, 15, 20],

    attachPageSizeMenuToBody: true
  };

  showModel = false;

  onFirstPage(_: any) {
    console.log('onFirstPage');
  }

  onLastPage(_: any) {
    console.log('onLastPage');
  }

  onPreviousPage(_: any) {
    console.log('onPreviousPage');
  }

  onNextPage(_: any) {
    console.log('onNextPage');
  }

  onPageSizeChange(_: any) {
    console.log('onPageSizeChange');
  }

  toggleModel() {
    this.showModel = !this.showModel;
  }
}
