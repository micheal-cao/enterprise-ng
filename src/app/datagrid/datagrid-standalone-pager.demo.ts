import { Component, NgZone, OnInit, ViewChild, } from '@angular/core';
import { SohoDataGridComponent, } from 'ids-enterprise-ng';
import { DatagridStandalonePagerDemoService } from './datagrid-standalone-pager-demo.service';

@Component({
  selector: 'app-datagrid-standalone-pager',
  templateUrl: './datagrid-standalone-pager.demo.html',
  providers: [ DatagridStandalonePagerDemoService ]
})
export class DatagridStandalonePagerDemoComponent implements OnInit {
  @ViewChild(SohoDataGridComponent, { static: true }) sohoDataGridComponent: SohoDataGridComponent;

  data: any[];
  columns: SohoDataGridColumn[];
  showPageSizeSelector = true;
  pageSize = 10;
  pageSizes = [ 5, 10, 25, 100 ];
  isFirstPage = true;
  isLastPage = true;

  // need to keep track of last filter and sort as setting data removes the visual state for these.
  private currentConditions: SohoDataGridFilterCondition[];
  private currentSort: SohoDataGridSortedEvent;

  constructor(
    private ngZone: NgZone,
    private datagridPagingService: DatagridStandalonePagerDemoService
  ) {}

  ngOnInit(): void {
    this.columns = this.datagridPagingService.getColumns();
    const result = this.datagridPagingService.initialPage(this.pageSize);
    this.updateTemplateVariables(result);
  }

  onFirstPage() {
    const result = this.datagridPagingService.initialPage(this.pageSize);
    this.updateTemplateVariables(result);
  }

  onPreviousPage() {
    const result = this.datagridPagingService.previousPage();
    this.updateTemplateVariables(result);
  }

  onNextPage() {
    const result = this.datagridPagingService.nextPage();
    this.updateTemplateVariables(result);
  }

  onLastPage() {
    const result = this.datagridPagingService.lastPage();
    this.updateTemplateVariables(result);
  }

  onSortPage(event: SohoDataGridSortedEvent): void {
    const result = this.datagridPagingService.sortPage();
    this.currentSort = event;
    this.updateTemplateVariables(result);

  }

  onFilterPage(event: SohoDataGridFilteredEvent): void {
    const result = this.datagridPagingService.filterPage();
    this.currentConditions = [...event.conditions];
    this.updateTemplateVariables(result);
  }

  onPageSizeChange(args: any[]) {
    this.pageSize = args[1].pagesize;
    const result = this.datagridPagingService.initialPage(this.pageSize);
    this.updateTemplateVariables(result);
  }

  private updateTemplateVariables(result: any) {
    this.data = result.data;
    this.isFirstPage = result.firstPage;
    this.isLastPage = result.lastPage;

    this.ngZone.runOutsideAngular(() => setTimeout(() => {
      if (this.currentConditions) {
        // todo: for disableClientFilter setting data resets the filter conditions - reset them here
        setTimeout(() => this.sohoDataGridComponent.setFilterConditions(this.currentConditions));
      }

      if (this.currentSort) {
        // todo: for disableClientSort setting data resets the sort - reset them here
        setTimeout(() => this.sohoDataGridComponent.setSortIndicator(this.currentSort.sortId, this.currentSort.sortAsc));
      }
    }));
  }

  onShowPageSizeSelector() {
    this.showPageSizeSelector = !this.showPageSizeSelector;
  }

  toggleFilterRow() {
    this.sohoDataGridComponent.toggleFilterRow();
  }
}
