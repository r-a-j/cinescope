import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastController = inject(ToastController);
  private currentToast: HTMLIonToastElement | null = null;
  
  // ==========================================
  // 📢 PUBLIC API
  // ==========================================

  public async presentSuccess(message: string, duration = 3000): Promise<void> {
    await this.presentToast(message, 'success', duration);
  }

  public async presentError(message: string, duration = 4000): Promise<void> {
    await this.presentToast(message, 'error', duration);
  }

  public async presentWarning(message: string, duration = 4000): Promise<void> {
    await this.presentToast(message, 'warning', duration);
  }

  public async presentInfo(message: string, duration = 3000): Promise<void> {
    await this.presentToast(message, 'info', duration);
  }

  // ==========================================
  // ⚙️ CORE IMPLEMENTATION
  // ==========================================

  private async presentToast(message: string, type: ToastType, duration: number): Promise<void> {
    // Dismiss any active toast to prevent overlapping/stacking UI bugs
    if (this.currentToast) {
      this.currentToast.dismiss();
    }

    // Determine the corresponding CSS class for our theme rules
    const colorClass = this.getColorClass(type);

    this.currentToast = await this.toastController.create({
      message: message,
      duration: duration,
      position: 'bottom',
      mode: 'ios', // Enforce iOS mode for cleaner unified styling across platforms
      cssClass: ['cinescope-toast', colorClass],
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    // Clean up reference when toast closes on its own
    this.currentToast.onDidDismiss().then(() => {
      this.currentToast = null;
    });

    await this.currentToast.present();
  }

  private getColorClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'error':
        return 'toast-error';
      case 'warning':
        return 'toast-warning';
      case 'info':
        return 'toast-info';
      default:
        return '';
    }
  }
}
