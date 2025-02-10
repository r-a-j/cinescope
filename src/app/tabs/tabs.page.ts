import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {

  activeTab: string = 'tab1';

  constructor(private router: Router) { }

  openSettings() {
    this.router.navigate(['/tabs/tab3']);
  }

  onTabChange(event: any) {
    this.activeTab = event.tab;
  }

}
