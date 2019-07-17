import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionComponent } from './components/accordion/accordion.component';
import { AccordionGroupComponent } from './components/accordion-group/accordion-group.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [AccordionComponent, AccordionGroupComponent],
  imports: [
    CommonModule,
    BrowserAnimationsModule
  ],
  exports: [AccordionComponent, AccordionGroupComponent]
})
export class AccordionIdsModule { }
