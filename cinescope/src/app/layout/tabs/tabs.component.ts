import { Component, EnvironmentInjector, inject, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import * as THREE from 'three';
import {
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
    flash, flashOutline,
    sparkles, sparklesOutline,
    grid, gridOutline,
    people, peopleOutline,
    person, personOutline
} from 'ionicons/icons';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
    selector: 'app-tabs',
    standalone: true,
    imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
    templateUrl: 'tabs.component.html',
    styleUrls: ['tabs.component.scss'],
})
export class TabsComponent implements AfterViewInit, OnDestroy {
    @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

    public environmentInjector = inject(EnvironmentInjector);
    private router = inject(Router);
    
    public activeTab = signal<string>('pulse');

    // Three.js Core
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private glassSlab!: THREE.Mesh;
    private pointLight!: THREE.PointLight;
    private animationFrameId?: number;
    private mouse = new THREE.Vector2();
    private targetRotation = new THREE.Vector2();

    @HostListener('window:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update target rotation based on mouse position
        this.targetRotation.y = this.mouse.x * 0.15;
        this.targetRotation.x = -this.mouse.y * 0.1;
    }

    @HostListener('window:resize')
    onResize() {
        if (!this.canvasContainer) return;
        const width = this.canvasContainer.nativeElement.clientWidth;
        const height = this.canvasContainer.nativeElement.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    constructor() {
        // Handle initial load
        const currentUrl = this.router.url;
        this.updateActiveTab(currentUrl);

        // Track the active tab for elegant state changes
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            takeUntilDestroyed() // Proper cleanup
        ).subscribe((event: any) => {
            this.updateActiveTab(event.urlAfterRedirects || event.url);
        });

        addIcons({
            flash, flashOutline,
            sparkles, sparklesOutline,
            grid, gridOutline,
            people, peopleOutline,
            person, personOutline
        });
    }

    ngAfterViewInit() {
        this.initThree();
        this.animate();
    }

    ngOnDestroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.renderer?.dispose();
    }

    private initThree() {
        const container = this.canvasContainer.nativeElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.z = 5;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // Glass Background Geometry
        // Even more depth (2.5) for a massive, heavy glass feel
        const geometry = new THREE.BoxGeometry(10, 4, 2.5);
        
        // Material with physical properties for "Glass" look
        const material = new THREE.MeshPhysicalMaterial({
            transmission: 1,
            thickness: 5.0, // Substantially increased for deep refraction
            roughness: 0.01, // Near perfect polish
            metalness: 0,
            ior: 2.4, // Diamond-level Index of Refraction
            clearcoat: 1,
            clearcoatRoughness: 0.01,
            transparent: true,
            opacity: 0.98,
            color: new THREE.Color(0xffffff),
            attenuationColor: new THREE.Color(0xffffff),
            attenuationDistance: 0.15 // Even shorter for intense depth perception
        });

        this.glassSlab = new THREE.Mesh(geometry, material);
        // Move it back further to accommodate the new thickness
        this.glassSlab.position.z = -3;
        this.scene.add(this.glassSlab);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        this.pointLight = new THREE.PointLight(0xffffff, 20);
        this.pointLight.position.set(0, 0, 2);
        this.scene.add(this.pointLight);

        // Update color initially
        this.updateThreeColor();
    }

    private animate() {
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        // Smoothly rotate the glass background towards the target (mouse-based)
        if (this.glassSlab) {
            this.glassSlab.rotation.x += (this.targetRotation.x - this.glassSlab.rotation.x) * 0.05;
            this.glassSlab.rotation.y += (this.targetRotation.y - this.glassSlab.rotation.y) * 0.05;

            // Liquid-like light movement
            const time = Date.now() * 0.001;
            if (this.pointLight) {
                this.pointLight.position.x = Math.sin(time * 0.5) * 2;
                this.pointLight.position.y = Math.cos(time * 0.3) * 0.5;
            }
        }

        this.renderer?.render(this.scene, this.camera);
    }

    private updateThreeColor() {
        if (!this.glassSlab || !this.pointLight) return;

        const tab = this.activeTab();
        const colors: { [key: string]: number } = {
            'pulse': 0xf85149,
            'oracle': 0x79c0ff,
            'vault': 0xffffff,
            'social': 0xd2a8ff,
            'identity': 0xf0883e
        };

        const targetColor = new THREE.Color(colors[tab] || 0xffffff);
        
        // Transition the light color
        this.pointLight.color.copy(targetColor);
        
        // Subtle color tint on the slab
        (this.glassSlab.material as THREE.MeshPhysicalMaterial).color.copy(targetColor).lerp(new THREE.Color(0xffffff), 0.95);
    }

    private updateActiveTab(url: string): void {
        const segments = url.split('/').filter(s => !!s);
        const tab = segments.pop() || 'pulse';
        
        const colors: { [key: string]: string } = {
            'pulse': '#f85149',
            'oracle': '#79c0ff',
            'vault': '#2ee7b6',
            'social': '#d2a8ff',
            'identity': '#f0883e'
        };

        if (colors[tab]) {
            this.activeTab.set(tab);
            // SET GLOBAL THEME COLOR
            document.documentElement.style.setProperty('--active-tab-color', colors[tab]);
            document.documentElement.style.setProperty('--active-tab-glow', `${colors[tab]}40`); // 25% opacity
            
            this.updateThreeColor();
        }
    }
}