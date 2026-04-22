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
    logOutOutline,
    trendingUpOutline,
    walletOutline,
    shieldOutline 
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
        <ion-content [fullscreen]="true" color="background" class="ion-no-padding">
            <div class="identity-container">
                <!-- Identity Header -->
                <header class="profile-header">
                    <div class="avatar-ring">
                        <img src="https://i.pravatar.cc/150?u=elara" alt="ELARA">
                    </div>
                    <div class="profile-meta">
                        <h2>ELARA_VOX.02</h2>
                        <p>Cine-Identity Level 9</p>
                    </div>
                </header>

                <!-- Value Index Card -->
                <section class="value-card glassmorphism">
                    <div class="card-header">
                        <ion-icon name="trending-up-outline"></ion-icon>
                        <h3>STREAMING VALUE INDEX</h3>
                    </div>
                    <div class="value-stats">
                        <div class="stat-item">
                            <span class="label">Savings This Month</span>
                            <span class="value">$24.50</span>
                        </div>
                        <div class="stat-item">
                            <span class="label">Churn Risk</span>
                            <span class="value low">LOW (12%)</span>
                        </div>
                    </div>
                    <div class="optimization-bar">
                        <div class="progress" style="width: 88%"></div>
                    </div>
                    <p class="opt-label">Optimal ROI Achieved</p>
                </section>

                <!-- Wallet & Access -->
                <div class="utility-grid">
                    <div class="util-card surface-card">
                        <ion-icon name="wallet-outline" color="primary"></ion-icon>
                        <div class="util-info">
                            <span class="label">Active Wallet</span>
                            <span class="value">0.452 ETH</span>
                        </div>
                    </div>
                    <div class="util-card surface-card alert">
                        <ion-icon name="shield-outline" color="warning"></ion-icon>
                        <div class="util-info">
                            <span class="label">Access Alert</span>
                            <span class="value">1 handshake</span>
                        </div>
                    </div>
                </div>

                <!-- Active Viewing Rooms -->
                <section class="rooms-section">
                    <div class="section-header">
                        <h2>ACTIVE VIEWING ROOMS</h2>
                    </div>
                    <div class="room-list">
                        <div class="room-item glassmorphism">
                            <div class="room-visual akira"></div>
                            <div class="room-info">
                                <h3>Neo-Tokyo Afterhours</h3>
                                <p>Watching: <span>Akira (4K)</span></p>
                            </div>
                            <div class="viewers">
                                <span class="dot"></span>
                                24
                            </div>
                        </div>

                        <div class="room-item glassmorphism">
                            <div class="room-visual runner"></div>
                            <div class="room-info">
                                <h3>Rainy Night Vibes</h3>
                                <p>Watching: <span>Blade Runner 2049</span></p>
                            </div>
                            <div class="viewers">
                                <span class="dot"></span>
                                12
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </ion-content>
    `,
    styles: [`
        .identity-container { padding: 100px 20px 100px; display: flex; flex-direction: column; gap: 24px; }
        
        // 👤 PROFILE HEADER
        .profile-header {
            display: flex; align-items: center; gap: 20px; padding: 20px 0;
            .avatar-ring {
                width: 80px; height: 80px; border-radius: 50%; padding: 4px;
                background: linear-gradient(45deg, var(--ion-color-primary), transparent);
                img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid var(--ion-background-color); }
            }
            .profile-meta {
                h2 { font-size: 2rem; margin: 0; letter-spacing: 1px; color: #ffffff; }
                p { margin: 4px 0 0; font-family: var(--font-body); font-size: 0.9rem; color: var(--ion-color-step-500); }
            }
        }

        // 📈 VALUE CARD
        .value-card {
            padding: 24px; border-radius: 24px;
            .card-header {
                display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
                ion-icon { font-size: 20px; color: var(--ion-color-primary); }
                h3 { margin: 0; font-size: 0.95rem; letter-spacing: 1px; }
            }
            .value-stats {
                display: flex; justify-content: space-between; margin-bottom: 20px;
                .stat-item {
                    display: flex; flex-direction: column; gap: 4px;
                    .label { font-size: 0.75rem; color: var(--ion-color-step-400); font-family: var(--font-body); }
                    .value { font-family: var(--font-display); font-size: 1.4rem; 
                        &.low { color: #4cd964; }
                    }
                }
            }
            .optimization-bar {
                height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-bottom: 8px; overflow: hidden;
                .progress { height: 100%; background: var(--ion-color-primary); border-radius: 3px; }
            }
            .opt-label { font-size: 0.7rem; color: var(--ion-color-step-500); font-family: var(--font-body); margin: 0; text-align: right; }
        }

        // 🛠️ UTILITY GRID
        .utility-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .util-card {
            padding: 20px; border-radius: 20px; display: flex; flex-direction: column; gap: 12px;
            ion-icon { font-size: 24px; }
            .util-info {
                .label { font-size: 0.7rem; color: var(--ion-color-step-400); font-family: var(--font-body); display: block; }
                .value { font-family: var(--font-display); font-size: 1.1rem; }
            }
            &.alert { background: rgba(var(--ion-color-warning-rgb), 0.05); border-color: rgba(var(--ion-color-warning-rgb), 0.1); }
        }

        // 📺 ROOMS SECTION
        .rooms-section {
            h2 { font-size: 1.2rem; margin-bottom: 16px; letter-spacing: 1px; }
            .room-list { display: flex; flex-direction: column; gap: 12px; }
            .room-item {
                display: flex; align-items: center; gap: 16px; padding: 12px; border-radius: 20px;
                .room-visual {
                    width: 60px; height: 60px; border-radius: 12px; background-size: cover; background-position: center;
                    &.akira { background-image: url('https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?q=80&w=2070'); }
                    &.runner { background-image: url('https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?q=80&w=2070'); }
                }
                .room-info {
                    flex: 1;
                    h3 { margin: 0 0 4px 0; font-size: 1rem; }
                    p { margin: 0; font-size: 0.8rem; font-family: var(--font-body); color: var(--ion-color-step-500); 
                        span { color: #ffffff; }
                    }
                }
                .viewers {
                    display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-family: var(--font-body); color: var(--ion-color-step-400);
                    .dot { width: 6px; height: 6px; border-radius: 50%; background: #4cd964; }
                }
            }
        }

        .surface-card { background: var(--ion-color-step-50); border: 1px solid var(--ion-color-step-100); }
        .glassmorphism { background: rgba(var(--ion-color-step-50-rgb), 0.6) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(var(--ion-color-step-100-rgb), 0.2); }
    `]
})
export class IdentityPage {
    constructor() {
        addIcons({ 
            personCircle, 
            shieldCheckmarkOutline, 
            colorPaletteOutline, 
            notificationsOutline, 
            logOutOutline,
            trendingUpOutline,
            walletOutline,
            shieldOutline
        });
    }
}

