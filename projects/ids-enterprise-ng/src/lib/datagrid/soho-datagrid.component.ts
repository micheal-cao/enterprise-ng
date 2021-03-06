/// <reference path="./soho-datagrid.d.ts" />

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  AfterViewChecked,
  ElementRef,
  Output,
  EventEmitter,
  HostBinding,
  Input,
  Optional,
  OnInit,
  OnDestroy,
  ComponentFactoryResolver,
  Injector,
  ApplicationRef,
  ComponentRef,
  Type,
  NgZone
} from '@angular/core';

import { ArgumentHelper } from '../utils/argument.helper';
import { SohoDataGridService } from './soho-datagrid.service';

export type SohoDataGridType = 'auto' | 'content-only';

/**
 * Contract for cell editors.
 */
export interface ExtendedSohoDataGridCellEditor extends SohoDataGridCellEditor {
  // The type of the component.
  component: Type<SohoDataGridCellEditor>;

  // The args passed to the editor
  args: SohoDataGridEditCellFunctionArgs;

  // This is the input element (single) within the field
  input: JQuery;

  // Use the direct value from the dataset vs the formatted value
  useValue: boolean;

  // The parent class of the inner editor. Used to determine if open or not.
  className: string;

  /**
   * Initialise the edit control with the given component.  The control
   * mist conform to the SohoDataGridCellEditor contract.
   */
  init(componentRef: ComponentRef<SohoDataGridCellEditor>): void;

  /**
   * Destroy the editor.
   */
  destroy(): void;
}

export class SohoAngularEditorAdapter implements ExtendedSohoDataGridCellEditor {
  componentRef: ComponentRef<SohoDataGridCellEditor>;

  input: JQuery;

  // Use the direct value from the dataset vs the formatted value
  useValue = true;

  // The parent class of the inner editor. Used to determine if open or not.
  className: string;

  constructor(
    public component: Type<SohoDataGridCellEditor>,
    public args: SohoDataGridEditCellFunctionArgs) {
  }

  init(componentRef: ComponentRef<SohoDataGridCellEditor>) {
    // Store the component.
    this.componentRef = componentRef;

    // The Soho datagrid wants an input control, otherwise it wont accept the editor
    // as a component.
    // @todo talk to Tim about removing this requirement.
    this.input = $(this.componentRef.location.nativeElement).find('input:first');
    this.className = this.componentRef.instance
      && this.componentRef.instance.className
      ? this.componentRef.instance.className : '.editor';
  }

  val(value?: any): any {
    return this.componentRef.instance.val(value);
  }

  focus(): void {
    this.componentRef.instance.focus();
  }

  destroy(): void {
    if (this.componentRef) {
      setTimeout(() => {
        this.componentRef.destroy();
        this.componentRef = null;
      });
    }
  }
}

/**
 * Internal refresh hints used to determine what type of "refresh" is
 * required after the change detection process has completed and the
 * AfterViewChecked method is called.
 */
enum RefreshHintFlags {
  // No refresh required.
  None = 0,
  // The rows needs to be re-rendered.
  RenderRows = 1,
  // The header needs to be re-renendered.
  RenderHeader = 2,
  // A full rebuild is required.
  Rebuild = 4
}

/**
 * Angular Wrapper for the Soho Data Grid Component.
 *
 * This component searches for an element with the attribute
 * 'soho-datagrid' in the parent's DOM tree, initialising it with
 * the Soho datagrid control.
 *
 * The data is provided either by a component input or an implementation
 * of the DataGridService interface, by specifying an implementation
 * on the hosting component, i.e.
 *
 * providers: [ provide: DataGridService, useClass: DataGridDemoService} ]
 */
@Component({
  selector: '[soho-datagrid]', // tslint:disable-line
  template: ' <ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SohoDataGridComponent implements OnInit, AfterViewInit, OnDestroy, AfterViewChecked {

  // -------------------------------------------
  // Soho Data Grid Types
  // -------------------------------------------

  // "auto" where columns and rows are obtained from the injected service
  // (if defined) or via the Inputs, otherwise.
  static AUTO: SohoDataGridType = 'auto';

  // 'content-only' where table elements are used to define the
  // columns and rows.
  static CONTENT_ONLY: SohoDataGridType = 'content-only';

  // -------------------------------------------
  // Component Inputs
  // -------------------------------------------

  /**
   * Sets the grid options for the data grid, marking this components
   * as requiring a full rebuild at the end of the change lifecycle.
   *
   * @param gridOptions - not null grid options.
   */
  @Input() set gridOptions(gridOptions: SohoDataGridOptions) {
    ArgumentHelper.checkNotNull('gridOptions', gridOptions);

    this._gridOptions = gridOptions;

    this.checkForComponentEditors();

    if (this.jQueryElement) {
      // No need to set the 'settings' as the Rebuild will create
      // a new control with the _gridOptions.
      this.markForRefresh('gridOptions', RefreshHintFlags.Rebuild);
    }
  }
  get gridOptions(): SohoDataGridOptions {
    if (this.datagrid) {
      return this.datagrid.settings;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions;
  }

  /**
   * Defines which property in the data rows is to be used as the id of each
   * row of the data.
   *
   * @param idProperty string id
   */
  @Input() set idProperty(idProperty: string) {
    this._gridOptions.idProperty = idProperty;
    if (this.datagrid) {
      this.datagrid.settings.idProperty = idProperty;
      this.markForRefresh('idProperty', RefreshHintFlags.Rebuild);
    }
  }

  get idProperty(): string {
    if (this.datagrid) {
      return this.datagrid.settings.idProperty;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.idProperty;
  }

  /**
   * The value of the frozenColumns option - returns the requested
   * value if the control has not been created yet.
   */
  get frozenColumns(): SohoDataGridFrozenColumns {
    if (this.datagrid) {
      return this.datagrid.settings.frozenColumns;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.frozenColumns;
  }

  /**
   * Sets the frozenColumns settings - will force a grid rebuild if the component has already been
   * created.
   *
   * @param frozenColumns - the frozenColumns settings.
   */
  @Input() set frozenColumns(frozenColumns: SohoDataGridFrozenColumns) {
    this._gridOptions.frozenColumns = frozenColumns;
    if (this.datagrid) {
      this.datagrid.settings.frozenColumns = frozenColumns;

      // Force all a full rebuild of the control.
      this.markForRefresh('frozenColumns', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * If true allows
   */
  @Input() set cellNavigation(cellNavigation: boolean) {
    this._gridOptions.cellNavigation = cellNavigation;
    if (this.jQueryElement) {
      this.datagrid.settings.cellNavigation = cellNavigation;
      this.markForRefresh('cellNavigation', RefreshHintFlags.RenderRows);
    }
  }

  get cellNavigation(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.cellNavigation;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.cellNavigation;
  }

  /**
   * Changes the row navigation setting of the data grid. If rowNavigation
   * is "false” then a border is not displayed around the row.
   *
   * Defaults to true.
   *
   * @param rowlNavigation i "false” then grid will NOT show a border around the row.
   */
  @Input() set rowNavigation(rowNavigation: boolean) {
    this._gridOptions.rowNavigation = rowNavigation;
    if (this.jQueryElement) {
      this.datagrid.settings.rowNavigation = rowNavigation;
      this.markForRefresh('rowNavigation', RefreshHintFlags.RenderRows);
    }
  }

  get rowNavigation(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.rowNavigation;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.rowNavigation;
  }

  /**
   * If true, displays the rows in the grid using alternate shading, otherwise
   * all the rows use the same shading.
   */
  @Input() set alternateRowShading(alternateRowShading: boolean) {
    this._gridOptions.alternateRowShading = alternateRowShading;
    if (this.jQueryElement) {
      this.datagrid.settings.alternateRowShading = alternateRowShading;
      this.markForRefresh('alternateRowShading', RefreshHintFlags.RenderRows);
    }
  }

  get alternateRowShading(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.rowNavigation;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.alternateRowShading;
  }

  /**
   * The data to be displayed provided as an array
   * of json objects compatible with the column meta
   * data provided.
   *
   * @param dataset - array of json objects
   */
  @Input() set dataset(dataset: Array<any>) {
    this._gridOptions.dataset = dataset;
    if (this.jQueryElement) {
      const pagerInfo: SohoPagerPagingInfo = {};
      this.datagrid.settings.dataset = dataset;

      this.ngZone.runOutsideAngular(() => {
        // @todo do we need hints as this may be bundled up with other changes.
        this.datagrid.updateDataset(dataset, pagerInfo);
      });
    }
  }

  /**
   * Return the dataset currently displayed by the datagrid.
   *
   * @return an array of objects.
   */
  get dataset(): any[] {

    // If the Soho control has been created, then the dataset
    // in the settings object will contain the rows currently
    // on display.
    if (this.datagrid) {
      return this.datagrid.settings.dataset;
    }

    // ... we've been called before the component has completed
    // initialisation, so no data has been set (or potentially
    // retrieved from a service), so the only option is the
    // Input dataset, which may be undefined.
    return this._gridOptions.dataset || [];
  }

  /**
   * If true the columns can be reorders; otherwise if false they are fixed.
   */
  @Input() set columnReorder(columnReorder: boolean) {
    this._gridOptions.columnReorder = columnReorder;
    if (this.datagrid) {
      this.datagrid.settings.columnReorder = columnReorder;
      this.markForRefresh('columnReorder', RefreshHintFlags.RenderHeader);
    }
  }

  get columnReorder(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.columnReorder;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.columnReorder;
  }

  @Input() set disableClientSort(disableClientSort: boolean) {
    this._gridOptions.disableClientSort = disableClientSort;
    if (this.datagrid) {
      this.datagrid.settings.disableClientSort = disableClientSort;
    }
  }

  get disableClientSort(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.disableClientSort;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.disableClientSort;
  }

  @Input() set disableClientFilter(disableClientFilter: boolean) {
    this._gridOptions.disableClientFilter = disableClientFilter;
    if (this.datagrid) {
      this.datagrid.settings.disableClientFilter = disableClientFilter;
    }
  }

  get disableClientFilter(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.disableClientFilter;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.disableClientFilter;
  }

  /**
   * If true, the grid allows edits, otherwise if false edits are disabled.
   */
  @Input() set editable(editable: boolean) {
    this._gridOptions.editable = editable;
    if (this.datagrid) {
      this.datagrid.settings.editable = editable;
      this.markForRefresh('editable', RefreshHintFlags.Rebuild);
    }
  }

  get editable(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.editable;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.editable;
  }

  /**
   * Input that defines a function which is used to determine if a row is disabled, or not.
   */
  @Input() set isRowDisabled(isRowDisabled: SohoIsRowDisabledFunction) {
    this._gridOptions.isRowDisabled = isRowDisabled;
    if (this.datagrid) {
      this.datagrid.settings.isRowDisabled = isRowDisabled;
      this.markForRefresh('isRowDisabled', RefreshHintFlags.RenderRows);
    }
  }

  get isRowDisabled(): SohoIsRowDisabledFunction {
    if (this.datagrid) {
      return this.datagrid.settings.isRowDisabled;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.isRowDisabled;
  }

  @Input() set isList(isList: boolean) {
    this._gridOptions.isList = isList;
    if (this.jQueryElement) {
      this.datagrid.settings.isList = isList;

      // calling rebuild as a brute force way of udpating the view.
      this.markForRefresh('isList', RefreshHintFlags.Rebuild);
    }
  }

  get isList(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.isList;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.isList;
  }

  @Input() set menuId(menuId: any) {
    this._gridOptions.menuId = menuId;
    if (this.jQueryElement) {
      this.datagrid.settings.menuId = menuId;
      this.markForRefresh('menuId', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * Sets the row height for the grid, to be one of the supported options.
   *
   * @param rowHeight - 'normal' | 'medium' | 'short'
   */
  @Input() set rowHeight(rowHeight: SohoDataGridRowHeight) {
    this._gridOptions.rowHeight = rowHeight;
    if (this.jQueryElement) {
      this.datagrid.settings.rowHeight = rowHeight;

      this.ngZone.runOutsideAngular(() => {
        // @todo add hints as this may be bundled up with other changes.
        this.datagrid.rowHeight(rowHeight);
      });
    }
  }

  /**
   * Sets the height of the row to something other then the three built in rowHeights.
   *
   * @param fixedRowHeight Any integer
   */
  @Input() set fixedRowHeight(fixedRowHeight: number) {
    this._gridOptions.fixedRowHeight = fixedRowHeight;
    if (this.jQueryElement) {
      this.datagrid.settings.fixedRowHeight = fixedRowHeight;
      this.markForRefresh('fixedRowHeight', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * Whether selection is enabled.
   *
   * @param selectable valid values are: 'multiple', 'single', 'mixed', 'siblings' and false.
   */
  @Input() set selectable(selectable: any) {
    this._gridOptions.selectable = selectable;
    if (this.jQueryElement) {
      // Just changing the datagrid.settings.selectable updates the datagrid view.
      this.datagrid.settings.selectable = selectable;
      this.markForRefresh('selectable', RefreshHintFlags.RenderRows);
    }
  }

  get selectable(): any {
    if (this.datagrid) {
      return this.datagrid.settings.selectable;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.selectable;
  }

  @Input() set clickToSelect(clickToSelect: boolean) {
    this._gridOptions.clickToSelect = clickToSelect;
    if (this.jQueryElement) {
      this.datagrid.settings.clickToSelect = clickToSelect;
      this.markForRefresh('clickToSelect', RefreshHintFlags.RenderRows);
    }
  }

  get clickToSelect(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.clickToSelect;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.clickToSelect;
  }

  @Input() set toolbar(toolbar: SohoToolbarOptions) {
    this._gridOptions.toolbar = toolbar;
    if (this.jQueryElement) {
      this.datagrid.settings.toolbar = toolbar;
      this.markForRefresh('toolbar', RefreshHintFlags.Rebuild);
    }
  }

  @Input() set saveUserSettings(settingsForSave: SohoDataGridSaveUserSettings) {
    this._gridOptions.saveUserSettings = settingsForSave;
    if (this.jQueryElement) {
      this.datagrid.settings.saveUserSettings = settingsForSave;
    }
  }

  @Input() set paging(paging: boolean) {
    this._gridOptions.paging = paging;
    if (this.jQueryElement) {
      this.datagrid.settings.paging = paging;

      // todo: update soho data grids view - this.updatePagingInfo()?
      this.markForRefresh('paging', RefreshHintFlags.Rebuild);
    }
  }
  get paging(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.paging;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.paging;
  }

  @Input() set pagesize(pagesize: number) {
    this._gridOptions.pagesize = pagesize;
    if (this.jQueryElement) {
      this.datagrid.settings.pagesize = pagesize;
      this.markForRefresh('pagesize', RefreshHintFlags.Rebuild);
    }
  }

  @Input() set pagesizes(pagesizes: Array<number>) {
    this._gridOptions.pagesizes = pagesizes;
    if (this.jQueryElement) {
      this.datagrid.settings.pagesizes = pagesizes;
      this.markForRefresh('pagesizes', RefreshHintFlags.Rebuild);
    }
  }

  @Input() set indeterminate(indeterminate: boolean) {
    this._gridOptions.indeterminate = indeterminate;
    if (this.jQueryElement) {
      this.datagrid.settings.indeterminate = indeterminate;
      this.markForRefresh('indeterminate', RefreshHintFlags.Rebuild);
    }
  }

  @Input() set actionableMode(actionableMode: boolean) {
    this._gridOptions.actionableMode = actionableMode;
    if (this.jQueryElement) {
      this.datagrid.settings.actionableMode = actionableMode;
      this.markForRefresh('actionableMode', RefreshHintFlags.Rebuild);
    }
  }

  get actionableMode(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.actionableMode;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.actionableMode;
  }

  @Input() set saveColumns(saveColumns: boolean) {
    this._gridOptions.saveColumns = saveColumns;
    if (this.jQueryElement) {
      this.datagrid.settings.saveColumns = saveColumns;
      this.markForRefresh('saveColumns', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * Input for the source function.
   *
   * @param source the dataset's source function.
   */
  @Input() set source(source: SohoDataGridSourceFunction) {
    this.updateSource(source);
    if (this.jQueryElement) {
      this.datagrid.settings.source = source;
      this.markForRefresh('source', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * Enables or disables the filter bar on the grid.
   *
   * @param filterable if true, the filter bar is displayed; otherwise no filter bar is displayed.
   */
  @Input() set filterable(filterable: boolean) {
    this._gridOptions.filterable = filterable;
    if (this.jQueryElement) {
      this.datagrid.settings.filterable = filterable;
      this.markForRefresh('filterable', RefreshHintFlags.Rebuild);
    }
  }
  get filterable(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.filterable;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.filterable;
  }

  /**
   * If true the datagrid is displayed as a tree, otherwise
   * the grid is displayed as flat rows.
   *
   * This field is dynamic, and will cause the grid to be rebuilt
   * if changed.
   *
   * @param treeGrid - boolean flag indicating if the data is hierarchical.
   */
  @Input() set treeGrid(treeGrid: boolean) {
    if (treeGrid !== this._gridOptions.treeGrid) {
      this._gridOptions.treeGrid = treeGrid;

      // If the jQuery control has been initialised, update it.
      if (this.jQueryElement) {
        this.datagrid.settings.treeGrid = treeGrid;
        this.markForRefresh('treeGrid', RefreshHintFlags.Rebuild);
      }
    }
  }

  get treeGrid(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.treeGrid;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.treeGrid;
  }

  /**
   * Returns the unqiue identifier; which may be undefined.
   */
  get uniqueId(): string {
    if (this.datagrid) {
      return this.datagrid.settings.uniqueId;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.uniqueId;
  }

  /**
   * Sets the unqiueId - will force a grid rebuild if the component has already been
   * created.
   *
   * @param unqiueId - the new id.
   */
  @Input() set uniqueId(uniqueId: string) {
    this._gridOptions.uniqueId = uniqueId;
    if (this.datagrid) {
      this.datagrid.settings.uniqueId = uniqueId;

      // Force all a full rebuild of the control.
      this.markForRefresh('uniqueId', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * The value of the rowReorder flag - returns the requested value if the control has not been created yet.
   */
  get rowReorder(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.rowReorder;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.rowReorder;
  }

  /**
   * Sets the rowReorder flag - will force a grid rebuild if the component has already been
   * created.
   *
   * @param rowReorder - if true the rows will be reorderable; otherwise they will not.
   */
  @Input() set rowReorder(value: boolean) {
    this._gridOptions.rowReorder = value;
    if (this.datagrid) {
      this.datagrid.settings.rowReorder = value;

      // Force all a full rebuild of the control.
      this.markForRefresh('rowReorder', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * The value of the showDirty flag - returns the requested value if the control has not been created yet.
   */
  get showDirty(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.showDirty;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.showDirty;
  }

  /**
   * Sets the showDirty flag - will force a grid rebuild if the component has already been
   * created.
   *
   * @param showDirty - if true then dirty rows will be highlighted; otherwise they will not.
   */
  @Input() set showDirty(value: boolean) {
    this._gridOptions.showDirty = value;
    if (this.datagrid) {
      this.datagrid.settings.showDirty = value;

      // Force all a full rebuild of the control.
      this.markForRefresh('showDirty', RefreshHintFlags.Rebuild);
    }
  }

  get disableRowDeactivation(): boolean {
    if (this.datagrid) {
      return this.datagrid.settings.disableRowDeactivation;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.disableRowDeactivation;
  }

  @Input() set disableRowDeactivation(value: boolean) {
    this._gridOptions.disableRowDeactivation = value;
    if (this.datagrid) {
      this.datagrid.settings.disableRowDeactivation = value;

      // Force all a full rebuild of the control.
      // this.markForRefresh('disableRowDeactivation', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * Used to hold an object that can be referenced in formatters
   * and editors or anywhere else a datagrid reference is available
   */
  @Input() set userObject(userObject: any) {
    this._gridOptions.userObject = userObject;
    if (this.datagrid) {
      this.datagrid.settings.userObject = userObject;
    }
  }

  get userObject(): any {
    if (this.datagrid) {
      return this.datagrid.settings.userObject;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.userObject;
  }

  /**
   * The value of the virtualized flag - returns the requested value if the control has not been created yet.
   */
  // get virtualized(): boolean {
  //   if (this.datagrid) {
  //     return this.datagrid.settings.virtualized;
  //   }

  //   // ... we've been called before the component has completed
  //   // initialisation, so return the current value from the
  //   // options.
  //   return this._gridOptions.virtualized;
  // }

  // /**
  //  * Sets the virtualized flag - will force a grid rebuild if the component has already been
  //  * created.
  //  *
  //  * @param virtualized - if true then the grid will be virtualized; otherwise it will not.
  //  */
  // @Input() set virtualized(value: boolean) {
  //   this._gridOptions.virtualized = value;
  //   if (this.datagrid) {
  //     this.datagrid.settings.virtualized = value;

  //     // Force all a full rebuild of the control.
  //     this.markForRefresh('virtualized', RefreshHintFlags.Rebuild);
  //   }
  // }

  /**
   * The value of the virtualRowBuffer option - returns the requested value if the control has not been created yet.
   */
  // get virtualRowBuffer(): number {
  //   if (this.datagrid) {
  //     return this.datagrid.settings.virtualRowBuffer;
  //   } else {
  //     return this._gridOptions.virtualRowBuffer;
  //   }
  // }

  // /**
  //  * Sets the virtualRowBuffer number - will force a grid rebuild
  //  * if the component has already been created.
  //  *
  //  * @param virtualRowBuffer - how many extra rows top and bottom to allow as a buffer.
  //  */
  // @Input() set virtualRowBuffer(value: number) {
  //   this._gridOptions.virtualRowBuffer = value;
  //   if (this.datagrid) {
  //     this.datagrid.settings.virtualRowBuffer = value;

  //     // Force all a full rebuild of the control.
  //     this.markForRefresh('virtualRowBuffer', RefreshHintFlags.Rebuild);
  //   }
  // }

  /**
   * The value of the groupable option - returns the requested
   * value if the control has not been created yet.
   */
  get groupable(): SohoDataGridGroupable {
    if (this.datagrid) {
      return this.datagrid.settings.groupable;
    }

    // ... we've been called before the component has completed
    // initialisation, so return the current value from the
    // options.
    return this._gridOptions.groupable;
  }

  /**
   * Sets the groupable settings - will force a grid rebuild if the component has already been
   * created.
   *
   * @param groupable - the groupable settings.
   */
  @Input() set groupable(value: SohoDataGridGroupable) {
    this._gridOptions.groupable = value;
    if (this.datagrid) {
      this.datagrid.settings.groupable = value;

      // Force all a full rebuild of the control.
      this.markForRefresh('groupable', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * The array of data to display in the grid.
   *
   * @param an array of objects matching the column definition.
   *
   * As this method can be called before the control is
   * initialised, stash the data for later, and only
   * call loadData on the control api if ready.
   */
  @Input() set data(data: any[]) {
    this.gridData = data;
    if (data && this.jQueryElement) {

      this.ngZone.runOutsideAngular(() => {
        // @todo add hints for this too, as other changes may force a rebuild?
        this.datagrid.loadData(data);
      });
    }
  }

  /**
   * The array of columns to display in the grid.
   *
   * As this method can be called before the control is
   * initialised, stash the data for later, and only
   * call loadData on the control api if ready.
   */
  @Input() set columns(columns: SohoDataGridColumn[]) {
    this._gridOptions.columns = columns || [];

    this.checkForComponentEditors();

    if (columns && this.jQueryElement) {

      this.ngZone.runOutsideAngular(() => {
        // @todo add hints for this too, as other changes may force a rebuild?
        this.datagrid.updateColumns(this._gridOptions.columns, this._gridOptions.columnGroups);
      });
    }
  }

  /**
   * The name of the column stretched to fill the width of the datagrid,
   * or 'last' where the last column will be stretched to fill the
   * remaining space.
   *
   * @param stretchColumn - the name of the column to stretch; or 'last',
   */
  @Input() set stretchColumn(stretchColumn: string) {
    this._gridOptions.stretchColumn = stretchColumn;
    if (this.jQueryElement) {
      this.datagrid.settings.stretchColumn = stretchColumn;
      this.markForRefresh('stretchColumn', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * The name of the column to stretch, or 'last' if the
   * last column is stretched.
   */
  get stretchColumn() {
    return this._gridOptions.stretchColumn;
  }

  /**
   * If true, column will recalculate its width and stretch if required on column change.
   * @param stretchColumnOnChange - If false stretch logic wont run on column change.
   */
  @Input() set stretchColumnOnChange(stretchColumnOnChange: boolean) {
    this._gridOptions.stretchColumnOnChange = stretchColumnOnChange;
    if (this.jQueryElement) {
      this.datagrid.settings.stretchColumnOnChange = stretchColumnOnChange;
      this.markForRefresh('stretchColumnOnChange', RefreshHintFlags.Rebuild);
    }
  }
  /**
   * The current value of stretchColumnOnChange.
   */
  get stretchColumnOnChange() {
    return this._gridOptions.stretchColumnOnChange;
  }

  /**
   * Whether to show the page size selector or not.
   */
  @Input() set showPageSizeSelector(showPageSizeSelector: boolean) {
    this._gridOptions.showPageSizeSelector = showPageSizeSelector;
    if (this.jQueryElement) {
      this.datagrid.settings.showPageSizeSelector = showPageSizeSelector;

      // todo: need a function in datagrid.js that allows toggling of the page size selector. for now I have to rebuild the datagrid.
      this.markForRefresh('showPageSizeSelector', RefreshHintFlags.Rebuild);
    }
  }

  /**
   * The column groups
   *
   * As this method can be called before the control is
   * initialised, stash the data for later, and only
   * call loadData on the control api if ready.
   */
  @Input() set columnGroup(columnGroups: SohoDataGridColumnGroup[]) {
    this._gridOptions.columnGroups = columnGroups || [];
    if (columnGroups && this._gridOptions.columns && this.jQueryElement) {

      // @todo add hints for this too, as other changes may force a rebuild?
      this.datagrid.updateColumns(this._gridOptions.columns, columnGroups);
    }
  }

  /**
   * The `emptyMessage` data grid option.
   * Use null or undefined to remove any empty message.
   */
  @Input() set emptyMessage(emptyMessage: SohoEmptyMessageOptions | null | undefined) {
    // Check for undefined/null and reset to the default message
    if (!emptyMessage) {
      // soho only takes a null here so making it so any !emptyMessage gets set to null
      emptyMessage = null;
    }

    this._gridOptions.emptyMessage = emptyMessage;
    if (this.jQueryElement) {
      this.datagrid.settings.emptyMessage = emptyMessage;
      this.ngZone.runOutsideAngular(() => {
        this.datagrid.setEmptyMessage(emptyMessage);
      });
    }
  }

  get emptyMessage(): SohoEmptyMessageOptions {
    return this._gridOptions.emptyMessage;
  }

  /**
   * Defines the source type of the grid, either:
   *
   * - "content-only" where table elements are provided in the body.
   * - "auto" where columns and rows are obtained for an
   *   injected service (if defined) or via the Inputs if not.
   */
  @Input('soho-datagrid') set sohoDatagrid(datagridType: SohoDataGridType) {
    this.datagridType = datagridType ? datagridType : SohoDataGridComponent.AUTO;
  }

  // -------------------------------------------
  // Component Output
  // -------------------------------------------

  // This event is fired when a row (or rows) are selected.
  @Output()
  selected = new EventEmitter<SohoDataGridSelectedEvent>();

  // This event is fired when a cell is changed.
  @Output()
  cellchange = new EventEmitter<SohoDataGridCellChangeEvent>();

  // This event is fired when a row is removed.
  @Output()
  rowRemove = new EventEmitter<SohoDataGridRowRemoveEvent>();

  // This event is fired when a row is added.
  @Output()
  rowAdd = new EventEmitter<SohoDataGridAddRowEvent>();

  // This event is fired when the grid is filtered.
  @Output()
  filtered = new EventEmitter<SohoDataGridFilteredEvent>();

  // This event is fired when a row in the grid is expanded.
  @Output()
  expandrow = new EventEmitter<SohoDataGridToggleRowEvent>();

  // This event is fired when a key is pressed
  @Output()
  keydown = new EventEmitter<SohoDataGridKeyDownEvent>();

  // This event is fired when edit mode is exited.
  @Output()
  exiteditmode = new EventEmitter<SohoDataGridEditModeEvent>();

  // This event is fired before edit mode is started.
  @Output()
  beforeentereditmode = new EventEmitter<SohoDataGridEditModeEvent>();

  // This event is fired when edit mode is entered.
  @Output()
  entereditmode = new EventEmitter<SohoDataGridEditModeEvent>();

  // This event is fired when a row in the grid is collapsed.
  @Output()
  collapserow = new EventEmitter<SohoDataGridToggleRowEvent>();

  @Output()
  sorted = new EventEmitter<SohoDataGridSortedEvent>();

  @Output()
  beforeRowActivated = new EventEmitter<SohoDataGridRowActivated>();

  @Output()
  rowActivated = new EventEmitter<SohoDataGridRowActivated>();

  @Output()
  rowDeactivated = new EventEmitter<SohoDataGridRowActivated>();

  @Output()
  rowClicked = new EventEmitter<SohoDataGridRowClicked>();

  @Output()
  rowDoubleClicked = new EventEmitter<SohoDataGridRowClicked>();

  @Output()
  contextMenu = new EventEmitter<SohoDataGridRowClicked>();

  @Output()
  rowReordered = new EventEmitter<SohoDataGridRowReorderedEvent>();

  @Output()
  openFilterRow = new EventEmitter<SohoDataGridOpenFilterRowEvent>();

  @Output()
  closeFilterRow = new EventEmitter<SohoDataGridCloseFilterRowEvent>();

  @Output()
  settingsChanged = new EventEmitter<SohoDataGridSettingsChangedEvent>();

  @Output()
  rendered = new EventEmitter<SohoDataGridRenderedEvent>();

  @Output()
  afterRender = new EventEmitter<SohoDataGridAfterRenderEvent>();

  // -------------------------------------------
  // Host Bindings
  // -------------------------------------------

  // Set the enable / disabled class (not working)
  @HostBinding('class.is-disabled')
  isDisabled = false;

  /**
   * Sets the role for the grid.
   */
  @HostBinding('attr.role')
  get datagridRole() {
    if (this._gridOptions.treeGrid) {
      return 'treegrid';
    } else {
      return 'datagrid';
    }
  }

  // -------------------------------------------
  // Private Member Data
  // -------------------------------------------

  // Reference to the jQuery control.
  private jQueryElement: JQuery;

  // Reference to the Soho datagrid control api.
  private datagrid: SohoDataGridStatic;

  // Reference to the grid's data.
  private gridData: any[];

  // The source type for the grid.
  private datagridType: string;

  // An internal gridOptions object that gets updated by using
  // the component's Inputs()
  private _gridOptions: SohoDataGridOptions = {
    stretchColumn: 'last' // default value
  };

  // Provides hints to the component after the next refresh.
  private refreshHint: RefreshHintFlags = RefreshHintFlags.None;

  // List of option names changed (for debugging).
  private changedOptions = [];

  // List of dynamic formatter components - keyed by the original args.
  private cellComponents: any[] = [];

  /**
   * Constructor.
   *
   * @param ngZone - the angular zone for this component.
   * @param elementRef - the element matching the component's selector.
   * @param changeDetector - the component's change detector.
   * @param resolver - component factory resolver (for editors/formatters).
   * @param injector - dynamic component injector (for editors/formatters).
   * @param datagridService - service for obtaining data (optional)
   */
  constructor(
    private ngZone: NgZone,
    private elementRef: ElementRef,
    private changeDetector: ChangeDetectorRef,
    private resolver: ComponentFactoryResolver,
    private injector: Injector,
    private app: ApplicationRef,
    @Optional() protected datagridService: SohoDataGridService) {

  }

  // -------------------------------------------
  // Public API
  // -------------------------------------------

  getColumnGroup(idx: number): string {
    return this.datagrid.getColumnGroup(idx);
  }

  getColumnById(idx: number): string {
    return this.datagrid.getColumnGroup(idx);
  }

  /**
   * Overrides the sort function used by the datagrid,
   * can only be used once the grid has been created.
   *
   * @todo this should made lazy.
   */
  setSortFunction(sortFunction: SohoDataGridSortFunction): void {
    if (this.datagrid) {
      this.datagrid.sortFunction = sortFunction;
    } else {
      throw new Error('datagrid not initialized.');
    }
  }

  /**
   * Sets the column and direction to sort the dataset on.
   *
   * Can only be used once the grid has been initialised, otherwise
   * an error is thrown.
   *
   * @param columnId the id of the column to sort on; must be non-null.
   * @param ascending if true sort ascending, otherwise descending.  If not supplied the setting is toggled.
   */
  setSortColumn(columnId: string, ascending?: boolean): void {
    if (this.datagrid) {
      this.ngZone.runOutsideAngular(() => {
        this.datagrid.setSortColumn(columnId, ascending);
      });
    } else {
      throw new Error('datagrid not initialized');
    }
  }

  /**
   * Used to set the sort indicator on a column when disableClientSort is set to true.
   */
  setSortIndicator(columnId: string, ascending: boolean): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.setSortIndicator(columnId, ascending);
    });
  }

  pageSize(): number {
    return this.datagrid.pager.settings.pagesize;
  }

  updatePagingInfo(pageInfo: SohoPagerPagingInfo): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.updatePagingInfo(pageInfo);
    });
  }

  enable(): void {
    this.isDisabled = false;
  }

  disable(): void {
    this.isDisabled = true;
  }

  updateRow(idx: number, row: any): void {
    ArgumentHelper.checkNotNull('row', row);

    this.ngZone.runOutsideAngular(() => {
      this.datagrid.updateRow(idx, row);
    });
  }

  hideColumn(id: any) {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.hideColumn(id);
    });
  }

  showColumn(id: any) {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.showColumn(id);
    });
  }

  columnById(id: string): Array<any> {
    return this.datagrid.columnById(id);
  }

  getColumns(): Array<any> {
    return this.datagrid.settings.columns;
  }

  getColumnGroups(): SohoDataGridColumnGroup[] {
    return this.datagrid.settings.columnGroups;
  }

  getColumnIndex(columnId: string): number {
    return this.datagrid.getColumnIndex(columnId);
  }

  getHeaderRowColumn(fld: any) {
    return this.datagrid.getHeaderRowColumn(fld);
  }

  /**
   * Adds a row of data to the datagrid at the given optional location.
   *
   * @param data the row of data to add.
   * @param location the optional localtion, 'top' or 'bottom' or a number.
   */
  addRow(data: any, location?: 'top' | 'bottom' | number) {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.addRow(data, location);
    });
  }

  removeRow(data: any) {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.removeRow(data);
    });
  }

  /**
   * Returns an array of the dirty rows in the grid.
   *
   * @return an array of the dirty rows in the grid.
   */
  dirtyRows(): Array<any> {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.dirtyRows();
    });
  }

  /**
   * Returns an array of the dirty cells in the grid.
   *
   * @return an array of the dirty cells in the grid.
   */
  dirtyCells(): Array<any> {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.dirtyCells();
    });
  }

  /**
   * Clear all dirty cells.
   */
  clearDirty(): void {
    return this.ngZone.runOutsideAngular(() => {
      this.datagrid.clearDirty();
    });
  }

  /**
   * Commit the cell that's currently in edit mode.
   */
  commitCellEdit(): void {
    return this.ngZone.runOutsideAngular(() => {
      this.datagrid.commitCellEdit();
    });
  }

  /**
   * Clear all dirty cells in given row.
   * @param row - the row number (idx) of the row.
   */
  clearDirtyRow(row: number): void {
    return this.ngZone.runOutsideAngular(() => {
      this.datagrid.clearDirtyRow(row);
    });
  }

  /**
   * Clear dirty on given cell.
   * @param row - the row number (idx) of the row
   * @param cell - the cell number (idx) of the cell
   */
  clearDirtyCell(row: number, cell: number): void {
    return this.ngZone.runOutsideAngular(() => {
      this.datagrid.clearDirtyCell(row, cell);
    });
  }

  /**
   * Clear all error for a given cell in a row
   * @param row The row index.
   * @param cell The cell index.
   */
  clearAllCellError(row: number, cell: number): void {
    this.ngZone.runOutsideAngular(() => this.datagrid.clearAllCellError(row, cell));
  }

  /**
   * Clear a cell with an error of a given type
   * @param row The row index.
   * @param cell The cell index.
   * @param type of error.
   */
  clearCellError(row: number, cell: number, type: any): void {
    this.ngZone.runOutsideAngular(() => this.datagrid.clearCellError(row, cell, type));
  }

  /**
   * Clear a row level all errors, alerts, info messages
   * @param row The row index.
   */
  clearRowError(row: number): void {
    this.ngZone.runOutsideAngular(() => this.datagrid.clearRowError(row));
  }

  /**
   * Clear all errors, alerts and info messages in entire datagrid.
   */
  clearAllErrors(): void {
    this.ngZone.runOutsideAngular(() => this.datagrid.clearAllErrors());
  }

  /**
   * Sets the status of a given row in the grid.
   *
   * @param idx - the row number (idx) of the row
   * @param status - status class name e.g. 'error'
   * @param tooltip - string value for tooltip message e.g. 'Error'
   */
  rowStatus(idx: number, status: string, tooltip: string): void {
    return this.ngZone.runOutsideAngular(() => {
      this.datagrid.rowStatus(idx, status, tooltip);
    });
  }

  /**
   * Return an array containing all of the currently modified rows, the type of modification
   * and the cells that are dirty and the data.
   * @returns An keyed object showing the dirty row info.
   */
  getModifiedRows(): SohoDataGridModifiedRows {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.getModifiedRows();
    });
  }

  /**
   * Set a cell to dirty and add the dirty icon visually.
   * @param row The row index
   * @param cell The cell index
   * @param toggle True to set it and false to remove it
   */
  setDirtyIndicator(row: number, cell: number, toggle: boolean): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.setDirtyIndicator(row, cell, toggle);
    });
  }

  /**
   * Removes all selected rows
   */
  removeSelected() {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.removeSelected();
    });
  }

  /**
   * Toggles the display of the filter row.
   */
  toggleFilterRow(): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.toggleFilterRow();
    });
  }

  /**
   * Accept conditions from outside or pull from filter row
   */
  applyFilter(conditions?: Array<SohoDataGridFilterCondition>): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.applyFilter(conditions);
    });
  }

  /**
   * Set the filter row from passed data / settings
   */
  setFilterConditions(conditions: Array<SohoDataGridFilterCondition>): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.setFilterConditions(conditions);
    });
  }

  /**
   * Get filter conditions in array form from the UI
   */
  filterConditions(): Array<SohoDataGridFilterCondition> {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.filterConditions();
    });
  }

  /**
   * Clears any filter defined, for this datagrid.
   */
  clearFilter(): void {
    this.ngZone.runOutsideAngular(() => {
      if (this.datagrid) {
        this.datagrid.clearFilter();
      }
    });
  }

  /**
   * Returns the rows currently selected on the data grid.
   * @return an array of SohoDataGridSelectedRow instances.
   * @deprecated use selectedRows instead.
   */
  getSelectedRows(): SohoDataGridSelectedRow[] {
    return this.ngZone.runOutsideAngular(() => {
      return this.selectedRows();
    });
  }

  /**
   * Returns the rows currently selected on the data grid.
   * @return an array of SohoDataGridSelectedRow instances.
   */
  selectedRows(): SohoDataGridSelectedRow[] {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.selectedRows();
    });
  }

  /**
   * Selects all the rows in the grid.
   */
  selectAllRows() {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.selectAllRows();
    });
  }

  /**
   * Unselects all the rows in the grid.
   */
  unSelectAllRows() {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.unSelectAllRows();
    });
  }

  /**
   * Sets the selected status of the specified row in the data grid.
   *
   * @param idx - the row number (idx) of the row to select.
   * @deprecated - use selectRows instead.
   */
  selectRow(idx: number) {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.selectRow(idx);
    });
  }

  /**
   * Deselects the specified row in the data grid.
   *
   * @param idx - the row number (idx) of the row to deselect.
   */
  unselectRow(idx: number) {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.unselectRow(idx);
    });
  }

  /**
   * Selects a range of rows based on the provided row indexes.
   *
   * @param start - the start index
   * @param end - then end index
   */
  selectRange(start: number, end: number) {
    const range: number[] = [start, end];
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.selectRowsBetweenIndexes(range);
    });
  }

  /**
   * Set the selected rows by passing the row index or an array of row indexes
   */
  selectRows(row: number | number[]) {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.selectRows(row);
    });
  }

  /**
   * Set the status of the checkbox on the header.
   *
   * @param state 'all', 'partial' or 'all'.
   */
  public setHeaderCheckboxState(state: SohoDataGridHeaderCheckboxState) {
    const headerCheckbox = this.jQueryElement.find('.datagrid-header').find('.datagrid-checkbox');
    if (headerCheckbox) {
      if (state === 'partial') {
        headerCheckbox.data('selected', 'partial')
          .addClass('is-checked is-partial');
      }

      if (state === 'all') {
        headerCheckbox.data('selected', 'all')
          .addClass('is-checked').removeClass('is-partial');
      }

      if (state === 'none') {
        headerCheckbox.data('selected', 'none')
          .removeClass('is-checked is-partial');
      }
    }
  }

  /**
   * Activate the row of the passed-in idx.
   * NOTE: valid only when selection mode is 'mixed'
   */
  activateRow(idx: number): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.activateRow(idx);
    });
  }

  /**
   * Deactivate the currently activated row.
   *
   * NOTE: valid only when selection mode is 'mixed'
   */
  deactivateRow(): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.deactivateRow();
    });
  }

  /**
   * Get the currently activated row.
   * NOTE: valid only when selection mode is 'mixed'
   */
  activatedRow(): SohoDataGridRowActivated {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.activatedRow();
    });
  }

  /**
   * Sets the active cell.
   * @param idx The index of the row of the cell to set active.
   * @param idx2 The index of the cell to set active.
   */
  public setActiveCell(idx: number, idx2: number): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.setActiveCell(idx, idx2);
    });
  }

  /**
   * Scrolls the row at <b>idx</b> into view in the view port.
   * @param idx The index of the row to scroll into view.
   */
  public scrollRowIntoView(idx: number): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.setActiveCell(idx, 0);
    });
  }

  /**
   * Returns an array of row numbers for the rows containing the value for the specified field.
   * @param fieldName The field name to search.
   * @param value The value to use in search.
   */
  findRowsByValue(fieldName: string, value: any): number[] {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.findRowsByValue(fieldName, value);
    });
  }

  /**
   * Programmatically trigger a call to the datagrid.settings.source
   * function with the given pagerType.
   * @param pagerType - a valid pager type.
   */
  triggerSource(pagerType: SohoDataGridTriggerSourcePagerType, callback?: Function): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.triggerSource(pagerType, callback);
    });
  }

  /**
   * Trigger export of grid data to Excel.
   * @param fileName The prefix name to be used for the exported file.
   * @param worksheetName The name to be used for the worksheet.
   * @param customDs A datasource to override the default (deprecated)
   */
  exportToExcel(fileName: string, worksheetName?: string, customDs?: Object[]): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.exportToExcel(fileName, worksheetName, customDs);
    });
  }

  /**
   * Trigger export of grid data to CSV formatted file.
   * @param fileName The prefix name to be used for the exported file.
   * @param customDs A datasource to override the default.
   * @param separator The separator to use in the cvs file, defaults to 'sep=,'
   */
  exportToCsv(fileName: string, customDs?: Object[], separator: string = 'sep=,'): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.exportToCsv(fileName, customDs, separator);
    });
  }

  /**
   * Updates the columns and columnGroups displayed on the grid.
   * @param columns The datagrid columns to update.
   * @param columnGroups The column groups to update.
   */
  updateColumns(columns: SohoDataGridColumn[], columnGroups: SohoDataGridColumnGroup[]): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.updateColumns(columns, columnGroups);
    });
  }

  /**
   * Parse a JSON array with columns and return the column object.
   * @param columnStr The json represntation of the column object.
   * @return  The array of columns.
   */
  columnsFromString(columns: string): Object { // @todo typings for return value
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.columnsFromString(columns);
    });
  }

  /**
   * Reset columns to their defaults (used on restore menu item).
   */
  resetColumns(): void {
    return this.ngZone.runOutsideAngular(() => {
      this.datagrid.resetColumns();
    });
  }

  /**
   * Open the personalize dialog.
   */
  personalizeColumns(): void {
    return this.ngZone.runOutsideAngular(() => {
      this.datagrid.personalizeColumns();
    });
  }

  /**
   * Restore the user settings from local Storage or as passed in.
   * @param settings The object containing the settings to use.
   */
  restoreUserSettings(settings: any): void {
    this.ngZone.runOutsideAngular(() => {
      this.datagrid.restoreUserSettings(settings);
    });
  }

  // -------------------------------------------
  // Event Handlers
  // -------------------------------------------

  /**
   * Handle a request to load the data for the grid from the service.
   *
   * @todo paging - not yet fully implemented?
   */
  private onDataRequest(request: SohoDataGridSourceRequest, response: SohoDataGridResponseFunction) {
    // The request for data is made by the datagrid, so jump back into the angular zone ...
    this.ngZone.run(() =>
      // ... request the data from the service ...
      this.datagridService.getData(request)
        .subscribe((results: Object[]) => {
          // .. on receipt, pass the data back to the datagrid but
          // outside the angular zone.
          this.ngZone.runOutsideAngular(() => response(results, request));
        }));
  }

  /**
   * Event fired after a child row has been expanded.
   */
  private onExpandRow(args: SohoDataGridRowExpandEvent) {
    const event = { grid: this, ...args };
    this.ngZone.run(() => {
      this.expandrow.next(event);
    });
  }

  /**
   * Event fired after a key is pressed
   */
  private onKeyDown(e: JQuery.Event, args: SohoDataGridKeyDownArgs, response: Function) {
    const event = { e, args, response };
    this.ngZone.run(() => {
      this.keydown.next(event);
    });
  }

  /**
   * Event fired after a child row has been expanded.
   * @param idProperty string id
   */
  @Input() set onBeforeSelect(beforeSelectFunction: SohoDataGridBeforeSelectFunction) {
    this._gridOptions.onBeforeSelect = beforeSelectFunction;
    if (this.datagrid) {
      this.datagrid.settings.onBeforeSelect = beforeSelectFunction;
      this.markForRefresh('onBeforeSelect', RefreshHintFlags.Rebuild);
    }
  }

  get onBeforeSelect(): SohoDataGridBeforeSelectFunction {
    if (this.datagrid) {
      return this.datagrid.settings.onBeforeSelect;
    }
    return this._gridOptions.onBeforeSelect;
  }

  /**
   * Event fired after edit mode is activated on an editor.
   * @param args the event arguments
   */
  private onExitEditMode(args: SohoDataGridEditModeEvent) {
    const event = { grid: this, ...args };
    this.ngZone.run(() => {
      this.exiteditmode.next(event);
    });
  }

  /**
   * Event fired before edit mode is activated on an editor.
   * @param args the event arguments
   */
  private onBeforeEnterEditMode(args: SohoDataGridEditModeEvent) {
    const event = { grid: this, ...args };
    this.ngZone.run(() => {
      this.beforeentereditmode.next(event);
    });
  }

  /**
   * Event fired when edit mode is activated on an editor.
   * @param args the event arguments
   */
  private onEnterEditMode(args: SohoDataGridEditModeEvent) {
    const event = { grid: this, ...args };
    this.ngZone.run(() => {
      this.entereditmode.next(event);
    });
  }

  /**
   * Event fired after a child row has been collapsed.
   */
  private onCollapseRow(args: SohoDataGridRowCollapseEvent) {
    const event = { grid: this, ...args };
    this.ngZone.run(() => {
      this.collapserow.next(event);
    });
  }

  /**
   * Event fired when a row has been added.
   */
  private onRowAdd(args: SohoDataGridAddRowEvent) {
    this.ngZone.run(() => {
      this.rowAdd.next(args);
    });
  }

  /**
   * Event fired when a cell has changed.
   */
  private onCellChange(args: SohoDataGridCellChangeEvent) {
    this.ngZone.run(() => {
      this.cellchange.next(args);
    });
  }

  /**
   * Event fired when a row has been clicked.
   */
  private onRowClicked(args: SohoDataGridRowClicked) {
    this.ngZone.run(() => {
      this.rowClicked.next(args);
    });
  }

  /**
   * Event fired when the filter row is closed.
   */
  private onCloseFilterRow(args: SohoDataGridCloseFilterRowEvent) {
    this.ngZone.run(() => {
      this.closeFilterRow.next(args);
    });
  }

  /**
   * Event fired when a context menu is is clicked.
   */
  private onContextMenu(args: SohoDataGridRowClicked) {
    this.ngZone.run(() => {
      this.contextMenu.next(args);
    });
  }

  /**
   * Event fired when a context menu is is clicked.
   */
  private onDoubleClick(args: SohoDataGridRowClicked) {
    this.ngZone.run(() => {
      this.rowDoubleClicked.next(args);
    });
  }

  /**
   * Event fired when the data is filtered.
   */
  private onFiltered(args: SohoDataGridFilteredEvent) {
    this.ngZone.run(() => {
      this.filtered.next(args);
    });
  }

  /**
   * Event fired when filter row opened.
   */
  private onOpenFilterRow(args: SohoDataGridOpenFilterRowEvent) {
    this.ngZone.run(() => {
      this.openFilterRow.next(args);
    });
  }

  /**
   * Event fired when a row is removed.
   */
  private onRowRemove(args: SohoDataGridRowRemoveEvent) {
    this.ngZone.run(() => {
      this.rowRemove.next(args);
    });
  }

  /**
   * Event fired when the data is rendered
   */
  private onRendered(args: SohoDataGridRenderedEvent) {
    this.ngZone.run(() => {
      this.rendered.next(args);
    });
  }

  /**
   * Event fired when the data is filtered.
   */
  private onAfterRender(args: SohoDataGridAfterRenderEvent) {
    this.ngZone.run(() => {
      this.afterRender.next(args);
    });
  }

  /**
   * Event fired before a row is activated.
   */
  private onBeforeRowActivated(args: SohoDataGridRowActivatedEvent) {
    this.ngZone.run(() => {
      this.beforeRowActivated.next(args);
    });
  }

  /**
   * Event fired when a row is activated.
   */
  private onRowActivated(args: SohoDataGridRowActivatedEvent) {
    this.ngZone.run(() => {
      this.rowActivated.next(args);
    });
  }

  /**
   * Event fired when a row is deactivated.
   */
  private onRowDeactivated(args: SohoDataGridRowDeactivatedEvent) {
    this.ngZone.run(() => {
      this.rowDeactivated.next(args);
    });
  }

  /**
   * Event fired when a row is reordered.
   */
  private onRowReordered(args: SohoDataGridRowReorderedEvent) {
    this.ngZone.run(() => {
      this.rowReordered.next(args);
    });
  }

  /**
   * Event fired when a row is selected or deselected.
   */
  private onSelected(args: SohoDataGridSelectedEvent) {
    this.ngZone.run(() => {
      this.selected.next(args);
    });
  }

  /**
   * Event fired when settings are changed on the grid.
   */
  private onSettingsChanged(args: SohoDataGridSettingsChangedEvent) {
    this.ngZone.run(() => {
      this.settingsChanged.next(args);
    });
  }

  /**
   * Event fired when the data is sorted.
   */
  private onSorted(args: SohoDataGridSortedEvent) {
    this.ngZone.run(() => {
      this.sorted.next(args);
    });
  }

  /**
   * Returns the row dom jQuery node.
   * @param  row The row index.
   * @param  includeGroups If true groups are taken into account.
   * @return The dom jQuery node
   */
  rowNode(row: number, includeGroups: boolean): any {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.rowNode(row, includeGroups);
    });
  }

  /**
   * Returns the cell dom node.
   * @param  row The row index.
   * @param  cell The cell index.
   * @param  includeGroups If true groups are taken into account.
   * @return The dom node
   */
  cellNode(row: number, cell: number, includeGroups: boolean): any {
    return this.ngZone.runOutsideAngular(() => {
      return this.datagrid.cellNode(row, cell, includeGroups);
    });
  }

  // ------------------------------------------
  // Lifecycle Events
  // ------------------------------------------

  /**
   * Initialize the component after Angular initializes the data-bound input properties.
   */
  ngOnInit() {
    this.updateSource(this._gridOptions.source);
  }

  /**
   * Called after Angular projects external content into its view.
   */
  ngAfterViewInit() {
    // Once the view is created and ready, initiaise the data grid component.
    this.buildDataGrid();
  }

  /**
   *
   */
  ngAfterViewChecked() {
    if (this.refreshHint !== RefreshHintFlags.None) {
      this.updateControl();
    }
  }

  /**
   * Cleanup just before Angular destroys the component.
   *
   * Unsubscribe observables, detach event handlers and remove other resources to avoid memory leaks.
   */
  ngOnDestroy() {
    this.destroyDataGrid();
  }

  // -------------------------------------------
  // Private Members
  // -------------------------------------------

  /**
   * Destroys the jQuery control (and any other resources)
   * associated with this component.
   */
  private destroyDataGrid(): void {
    // Remove any remaining dynamic components.
    this.cellComponents.forEach((c) => { c.component.destroy(); });

    // Clear the cache.
    this.cellComponents = [];

    // Now destroy the grid.
    if (this.datagrid) {
      if (this.datagrid.destroy) {
        this.ngZone.runOutsideAngular(() => {
          this.datagrid.destroy();
        });
      }
      this.datagrid = null;
    }
  }

  /**
   * Handles the 'postCellRender' event.
   *
   * @param container the container to host the element.
   * @param args the formatter arguments.
   */
  private onPostRenderCell(container: JQuery, args: SohoDataGridPostRenderCellArgs) {
    // Pre-conditions
    if (!args.col.component) {
      return; // throw Error(`Missing 'component' in column ${args.col.id}`);
    }
    // Get the factory for the component specified on the column.
    const factory = this.resolver.resolveComponentFactory(args.col.component);

    // Create an injector that will provide the arguments for the
    // component.
    // const injector = ReflectiveInjector.resolveAndCreate([{ provide: 'args', useValue: args }], this.injector);
    const injector = Injector.create({ providers: [{ provide: 'args', useValue: args }], parent: this.injector });

    // Create the component, in the container.
    const component = factory.create(injector, [], container);

    // Copy into it any column level Inputs, these are optional but allow
    // column specific overrides to be defined.
    Object.assign(component.instance, args.col.componentInputs);

    // ... attach to the app ...
    this.app.attachView(component.hostView);

    // ... update for changes ...
    component.changeDetectorRef.detectChanges();

    // Do this at the end?

    // ... finally store the created component for later, we'll delete it when
    // requested, or when the grid is destroyed.
    this.cellComponents.push(
      { row: args.row, cell: args.cell, component }
    );
  }

  /**
   * Handles the 'destroyCell' event.
   * @param container the container.
   * @param args the args
   */
  private onDestroyCell(args: SohoDataGridPostRenderCellArgs) {
    const idx = this.cellComponents.findIndex((c) => args.row === c.row && args.cell === c.cell);
    if (idx > -1) {
      this.cellComponents[idx].component.destroy();
      this.cellComponents.splice(idx, 1);
    }
  }

  private onEditCell(editor: ExtendedSohoDataGridCellEditor) {
    // Pre-conditions
    if (!editor.component) {
      return; // throw Error(`Missing 'component' in column ${args.col.id}`);
    }
    // Get the factory for the component specified on the column.
    const factory = this.resolver.resolveComponentFactory(editor.component);

    // Create an injector that will provide the arguments for the
    // component.
    // const i = ReflectiveInjector.resolveAndCreate([{ provide: 'args', useValue: editor.args }], this.injector);
    const i = Injector.create({
      providers: [{ provide: 'args', useValue: editor.args }],
      parent: this.injector
    });

    // Warning!! the dynamic component is not added inside the container,
    // but as a sibling, so when it's destroyed it takes any siblings  with
    // it.  It is not clear why this - so to work around this issue, add
    // a single child to the cell container.
    const transientContainer = $('<div></div>').appendTo(editor.args.container);

    // Create the component, in the container.
    const componentRef = factory.create(i, [], transientContainer[0]) as ComponentRef<SohoDataGridCellEditor>;

    // Copy into it any column level Inputs, these are optional but allow
    // column specific overrides to be defined.
    Object.assign(componentRef.instance, editor.args.col.editorComponentInputs);

    // ... attach to the app ...
    this.app.attachView(componentRef.hostView);

    // ... update for changes ...
    componentRef.changeDetectorRef.detectChanges();

    // Give the component to the editor.
    editor.init(componentRef);
  }

  private buildDataGrid(): void {
    // call outside the angular zone so change detection
    // isn't triggered by the soho component.
    this.ngZone.runOutsideAngular(() => {
      // Wrap the element in a jQuery selector.
      this.jQueryElement = jQuery(this.elementRef.nativeElement);

      // Add the onPostCellRenderer
      this._gridOptions.onPostRenderCell = (c, args: SohoDataGridPostRenderCellArgs) => {
        this.onPostRenderCell(c, args);
      };

      // Add the destroy cell callback.
      this._gridOptions.onDestroyCell = (c, args: SohoDataGridPostRenderCellArgs) => {
        this.onDestroyCell(args);
      };

      // Add the edit cell callback.
      this._gridOptions.onEditCell = (editor: ExtendedSohoDataGridCellEditor) => {
        this.onEditCell(editor);
      };

      // Add the keydown callback.
      this._gridOptions.onKeyDown = (e: JQuery.Event, args: SohoDataGridKeyDownArgs, response: Function) => {
        this.onKeyDown(e, args, response);
      };

      // Initialise any event handlers.
      this.jQueryElement
        .on('addrow', (e: any, args: SohoDataGridAddRowEvent) => { this.onRowAdd(args); })
        .on('cellchange', (e: any, args: SohoDataGridCellChangeEvent) => this.onCellChange(args))
        .on('click', (e: any, args: SohoDataGridRowClicked) => { this.onRowClicked(args); })
        .on('closefilterrow', (e: any, args: SohoDataGridCloseFilterRowEvent) => { this.onCloseFilterRow(args); })
        .on('collapserow', (e: any, args: SohoDataGridRowCollapseEvent) => { this.onCollapseRow(args); })
        .on('contextmenu', (e: any, args: SohoDataGridRowClicked) => { this.onContextMenu(args); })
        .on('dblclick', (e: JQuery.TriggeredEvent, args: SohoDataGridRowClicked) => { this.onDoubleClick(args); })
        .on('beforeentereditmode', (e: any, args: SohoDataGridEditModeEvent) => { this.onBeforeEnterEditMode(args); })
        .on('exiteditmode', (e: any, args: SohoDataGridEditModeEvent) => { this.onExitEditMode(args); })
        .on('entereditmode', (e: any, args: SohoDataGridEditModeEvent) => { this.onEnterEditMode(args); })
        .on('expandrow', (e: any, args: SohoDataGridRowExpandEvent) => { this.onExpandRow(args); })
        .on('filtered', (e: any, args: SohoDataGridFilteredEvent) => { this.onFiltered(args); })
        .on('openfilterrow', (e: any, args: SohoDataGridOpenFilterRowEvent) => { this.onOpenFilterRow(args); })
        .on('rowremove', (e: any, args: SohoDataGridRowRemoveEvent) => { this.onRowRemove(args); })
        .on('rendered', (e: any, args: SohoDataGridRenderedEvent) => { this.onRendered(args); })
        .on('afterrender', (e: any, args: SohoDataGridAfterRenderEvent) => { this.onAfterRender(args); })
        .on('beforerowactivated', (e: any, args: SohoDataGridRowActivatedEvent) => { this.onBeforeRowActivated(args); })
        .on('rowactivated', (e: any, args: SohoDataGridRowActivatedEvent) => { this.onRowActivated(args); })
        .on('rowdeactivated', (e: any, args: SohoDataGridRowDeactivatedEvent) => { this.onRowDeactivated(args); })
        .on('rowreorder', (e: any, args: SohoDataGridRowReorderedEvent) => { this.onRowReordered(args); })
        .on('selected',
          (e: any,
            args: SohoDataGridSelectedRow[],
            type?: SohoDataGridSelectedEventType) => this.onSelected({ e, rows: args, type }))
        .on('settingschanged', (e: any, args: SohoDataGridSettingsChangedEvent) => { this.onSettingsChanged(args); })
        .on('sorted', (e: any, args: SohoDataGridSortedEvent) => { this.onSorted(args); });
    });

    // Initialise the SohoXi control.
    this.jQueryElement.datagrid(this._gridOptions);

    // Once the control is initialised, extract the control
    // plug-in from the element.  The element name is
    // defined by the plug-in, but in this case is 'datagrid'.
    this.datagrid = this.jQueryElement.data('datagrid');

    // If "auto" and there's a service, get the columns from it.
    // (may want to check if columns have already been set? Error?)
    if (this.datagridType === SohoDataGridComponent.AUTO && this.datagridService) {
      // Bootstrap from service, note this is not async.
      this.columns = this.datagridService.getColumns();
      // Once the columns are set, request the data (paging?)
      this.datagridService.getData(null)
        .subscribe((data: any[]) => {
          this.ngZone.runOutsideAngular(() => {
            this.datagrid.loadData(data);
          });
        });
    } else if (this.gridData) {
      // Not using a service, so use the pre-loaded data.
      this.ngZone.runOutsideAngular(() => {
        this.datagrid.loadData(this.gridData);
      });
    }
  }

  /**
   * Marks the components as requiring a rebuild after the next update.
   *
   * @todo possible add hints? Rebuild, Update, SetOption
   *
   * @param optionName - the option that was updated, (allowing specific handling)
   * @param hint - the type of refresh required, update?.
   */
  private markForRefresh(optionName: string, hint: RefreshHintFlags) {

    // Merge in the hint.
    this.refreshHint |= hint; // tslint:disable-line

    // ... so we can use it later
    this.changedOptions.push(optionName);

    // ... make sure the change detector kicks in, otherwise if the inputs
    // were change programmatially the component may not be eligible for
    // updating.
    this.changeDetector.markForCheck();
  }

  /**
   * Stop gap method to update the current datagrid and rebuild it again.
   *
   * This is required whilst there is no method found that can update the view
   * for a particular input.
   */
  private updateControl(): void {

    // Prevent nasty refreshes by running outside angular.
    this.ngZone.runOutsideAngular(() => {
      if (this.refreshHint & RefreshHintFlags.Rebuild) { // tslint:disable-line
        this.destroyDataGrid();
        this.buildDataGrid();

        // Assume a rebuild trumps all other candidates ...
      } else {
        // @todo verify if calling these separately makes sense.
        if (this.refreshHint & RefreshHintFlags.RenderHeader) { // tslint:disable-line
          this.datagrid.renderHeader();
        }
        if (this.refreshHint & RefreshHintFlags.RenderRows) { // tslint:disable-line
          this.datagrid.renderRows();
        }
      }

      // Reset the flags.
      this.refreshHint = RefreshHintFlags.None;
      this.changedOptions = [];
    });
  }

  /**
   * Updates the source setting/function to use source input if set.
   * Otherwise use dataGridService if that is set.
   *
   * @param source the function
   */
  private updateSource(source: SohoDataGridSourceFunction): void {
    // If a source property has not been defined, and a service has
    // use the data service to load the data dynamically for paging.
    if (!source && this.datagridService) {
      this._gridOptions.source = (request: SohoDataGridSourceRequest, response: SohoDataGridResponseFunction) => {
        this.onDataRequest(request, response);
      };
    } else if (source && typeof source === 'function') {
      this._gridOptions.source = (request: SohoDataGridSourceRequest, response: SohoDataGridResponseFunction) => {
        this.ngZone.run(() => source(request, response));
      };
    }
  }

  private checkForComponentEditors() {
    // Add an adapter for all the columns using an component as an editor.
    this._gridOptions.columns.forEach((c) => {
      if (c.editorComponent) {
        // Use a `function expression` rather than an `arrow function` as the editor is used
        // as constructor.
        // tslint:disable-next-line: max-line-length
        c.editor = function (row?: any, cell?: any, value?: any, container?: JQuery, col?: SohoDataGridColumn, e?: any, api?: any, item?: any) {
          return new SohoAngularEditorAdapter(c.editorComponent, { row, cell, value, container: container[0], col, e, api, item });
        };
      }
    });
  }
}

/**
 * Details of the 'expandrow' and 'collapserow' events.
 */
export interface SohoDataGridToggleRowEvent extends SohoDataGridRowExpandEvent {
  // The data grid component originating the call.
  grid: SohoDataGridComponent;
  args?: any;
}

/**
 * Details of the 'keydown' event
 */
export interface SohoDataGridKeyDownEvent {
  // The data grid component originating the call.
  e: JQuery.Event;
  args?: SohoDataGridKeyDownArgs;
  response?: Function;
}
