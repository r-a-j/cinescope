import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BottomSheetComponent } from 'src/app/shared/components/bottom-sheet/bottom-sheet.component';

@Component({
    selector: 'app-skeleton-test',
    templateUrl: './skeleton-test.page.html',
    styleUrls: ['./skeleton-test.page.scss'],
    standalone: true,
    imports: [IonicModule, CommonModule, BottomSheetComponent]
})
export class SkeletonTestPage implements OnInit {

    items = Array.from({ length: 50 }, (_, i) => i + 1);

    constructor() { }

    ngOnInit() {
    }

}
