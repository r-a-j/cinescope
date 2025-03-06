import { APP_INITIALIZER, importProvidersFrom, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule, routes } from './app-routing.module';
import { AppComponent } from './app.component';
import { provideHttpClient } from '@angular/common/http';
import { SQLiteService } from '../services/sqlite.service';
import { InitializeAppService } from '../services/initialize.app.service';
import { StorageService } from '../services/storage.service';
import { DbnameVersionService } from '../services/dbname-version.service';

export function initializeFactory(init: InitializeAppService) {
  return () => init.initializeApp();
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(
      {
        animated: true
      }
    ),
    AppRoutingModule
  ],
  providers: [
    SQLiteService,
    InitializeAppService,
    StorageService,
    DbnameVersionService,
    {
      provide: RouteReuseStrategy,
      useClass: IonicRouteStrategy
    },
    provideHttpClient(),
    importProvidersFrom(IonicModule.forRoot({})),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeFactory,
      deps: [InitializeAppService],
      multi: true
    },
    provideRouter(routes)
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
