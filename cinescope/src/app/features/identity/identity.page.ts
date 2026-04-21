import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { addIcons } from 'ionicons';
import { 
    personCircle, 
    shieldCheckmarkOutline, 
    colorPaletteOutline, 
    notificationsOutline, 
    logOutOutline 
} from 'ionicons/icons';

@Component({
    selector: 'app-identity',
    standalone: true,
    imports: [
        CommonModule,
        IonContent,
        IonIcon,
        HeaderComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <app-header></app-header>
        <ion-content color="background" class="ion-no-padding">
            <div class="identity-container">
                <div class="profile-section">
                    <div class="avatar-wrapper">
                        <div class="avatar-ring"></div>
                        <ion-icon name="person-circle" class="avatar-icon"></ion-icon>
                    </div>
                    <h2 class="user-name">Digital Curator</h2>
                    <p class="user-status">Premium Tier • 2026 Active</p>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">128</span>
                        <span class="stat-label">Vaulted</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">42</span>
                        <span class="stat-label">Insights</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">5.0</span>
                        <span class="stat-label">Curation</span>
                    </div>
                </div>
            </div>
        </ion-content>
    `,
    styles: [`
        .identity-container { padding: 24px; display: flex; flex-direction: column; gap: 32px; }
        .profile-section {
            display: flex; flex-direction: column; align-items: center; text-align: center;
            padding: 30px 20px; background: rgba(255, 255, 255, 0.03); border-radius: 32px;
            border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px);
        }
        .avatar-wrapper {
            position: relative; margin-bottom: 20px;
            .avatar-icon { font-size: 100px; color: #f0883e; filter: drop-shadow(0 0 20px rgba(240, 136, 62, 0.5)); }
            .avatar-ring {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 120px; height: 120px; border: 2px solid rgba(240, 136, 62, 0.2);
                border-radius: 50%; animation: ring-pulse 4s infinite alternate;
            }
        }
        .user-name { font-family: var(--font-display); font-size: 32px; margin: 0; color: #ffffff; }
        .user-status { font-size: 12px; color: rgba(255, 255, 255, 0.5); margin: 6px 0 0; text-transform: uppercase; letter-spacing: 2px; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .stat-card {
            background: rgba(255, 255, 255, 0.02); padding: 20px 10px; border-radius: 20px;
            display: flex; flex-direction: column; align-items: center; border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .stat-value { font-family: var(--font-display); font-size: 24px; color: #f0883e; }
        .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255, 255, 255, 0.4); margin-top: 4px; }

        @keyframes ring-pulse {
            from { transform: translate(-50%, -50%) scale(0.9); opacity: 0.2; }
            to { transform: translate(-50%, -50%) scale(1.1); opacity: 0.5; }
        }
    `]
})
export class IdentityPage {
    constructor() {
        addIcons({ personCircle, shieldCheckmarkOutline, colorPaletteOutline, notificationsOutline, logOutOutline });
    }
}
