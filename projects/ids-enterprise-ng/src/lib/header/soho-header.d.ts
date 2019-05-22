/**
 * Soho Header.
 *
 * This file contains the Typescript mappings for the public
 * interface of the Soho header control.
 */

/**
 * Header Options
 */
interface SohoHeaderOptions {
  /**
   * Passes in settings that will be applied to the underlying Toolbar component
   */
  toolbarSettings?: SohoToolbarOptions|SohoToolbarFlexOptions;

  /**
   * Determines whether a standard or Flex toolbar will be used inside the Header.
   * If true, will use a Flex Toolbar.
   * If false, will use a Standard Toolbar.
   */
  useFlexToolbar?: boolean;
}

/**
 * This interface represents the public API exposed by the
 * editor.
 */
interface SohoHeaderStatic {
  /** Control options. */
  settings: SohoHeaderOptions;

  /**
   * Removes go back button
   * Resets header button back to the hamburger button
   */
  removeBackButton(): void;

  /**
   * Disable the control.
   */
  disable(): void;

  /**
   * Enable the control.
   */
  enable(): void;

  /**
   * Mark the control as readonly.
   */
  readonly(): void;

  /**
   * Opens the expanded area.
   */
  open(): void;

  /**
   * Closes the exanded area.
   */
  close(): void;

  /**
   * Updates the component
   */
  updated(settings?: SohoHeaderOptions): void;

  /**
   * Destroys any resources created by this control.
   */
  destroy(): void;
}

/**
 * JQuery Integration
 */
interface JQueryStatic {
  header: SohoHeaderStatic;
}

interface JQuery<TElement = HTMLElement> extends Iterable<TElement> {
  header(options?: SohoHeaderOptions): JQuery;
}

/**
 * Type safe event.
 */
interface SohoExpandableAreaEvent extends JQuery.TriggeredEvent {
}
