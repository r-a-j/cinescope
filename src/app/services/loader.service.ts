import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';

@Injectable({
    providedIn: 'root'
})
export class LoaderService {
    private loader: HTMLIonLoadingElement | null = null;

    constructor(private loadingController: LoadingController) { }

    /**
     * Shows the loader with an optional message.
     */
    async showLoader(message: string = 'Loading...'): Promise<void> {
        if (!this.loader) {
            this.loader = await this.loadingController.create({
                message,
                spinner: 'crescent'
            });
            await this.loader.present();
        }
    }

    /**
     * Hides and dismisses the loader.
     */
    async hideLoader(): Promise<void> {
        if (this.loader) {
            await this.loader.dismiss();
            this.loader = null;
        }
    }
}
