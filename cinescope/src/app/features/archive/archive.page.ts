import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';


@Component({
  selector: 'app-archive',
  templateUrl: './archive.page.html',
  styleUrls: ['./archive.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivePage { }
