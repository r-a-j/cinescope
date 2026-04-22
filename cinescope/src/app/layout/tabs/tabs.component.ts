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
    person, personOutline,
    search, searchOutline,
    settings, settingsOutline
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
    private readonly TAB_COLORS: Record<string, string> = {
        'pulse': '#f85149',
        'oracle': '#79c0ff',
        'vault': '#2ee7b6',
        'social': '#d2a8ff',
        'search': '#00d4ff',
        'identity': '#f0883e',
        'settings': '#94a3b8'
    };

    @HostListener('window:mousemove', ['$event'])
    onMouseMove(event: MouseEvent): void {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update target rotation based on mouse position
        this.targetRotation.y = this.mouse.x * 0.15;
        this.targetRotation.x = -this.mouse.y * 0.1;
    }

    @HostListener('window:resize')
    onResize(): void {
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
        ).subscribe((event: unknown) => {
            this.updateActiveTab((event as NavigationEnd).urlAfterRedirects || (event as NavigationEnd).url);
        });

        addIcons({
            flash, flashOutline,
            sparkles, sparklesOutline,
            grid, gridOutline,
            people, peopleOutline,
            person, personOutline,
            search, searchOutline,
            settings, settingsOutline
        });
    }

    ngAfterViewInit(): void {
        this.initThree();
        this.animate();
    }

    ngOnDestroy(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.renderer?.dispose();
    }

    private initThree(): void {
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

        // Glass Background Geometry (Rounded)
        // Creating a custom rounded rectangle shape for "Ultimate Elegance"
        const geoWidth = 12;
        const geoHeight = 5;
        const radius = 1.2;
        const shape = new THREE.Shape();

        shape.moveTo(-geoWidth / 2 + radius, -geoHeight / 2);
        shape.lineTo(geoWidth / 2 - radius, -geoHeight / 2);
        shape.absarc(geoWidth / 2 - radius, -geoHeight / 2 + radius, radius, -Math.PI / 2, 0, false);
        shape.lineTo(geoWidth / 2, geoHeight / 2 - radius);
        shape.absarc(geoWidth / 2 - radius, geoHeight / 2 - radius, radius, 0, Math.PI / 2, false);
        shape.lineTo(-geoWidth / 2 + radius, geoHeight / 2);
        shape.absarc(-geoWidth / 2 + radius, geoHeight / 2 - radius, radius, Math.PI / 2, Math.PI, false);
        shape.lineTo(-geoWidth / 2, -geoHeight / 2 + radius);
        shape.absarc(-geoWidth / 2 + radius, -geoHeight / 2 + radius, radius, Math.PI, Math.PI * 1.5, false);

        const extrudeSettings = {
            steps: 2,
            depth: 2.5, // Increased slab depth
            bevelEnabled: true,
            bevelThickness: 0.6, // Deeper bevel for more light catch
            bevelSize: 0.6,
            bevelOffset: 0,
            bevelSegments: 16 // Smoother bevel
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Material with physical properties for "Ultimate Glass" look
        const material = new THREE.MeshPhysicalMaterial({
            transmission: 1,
            thickness: 6.0, // Deeper base thickness
            roughness: 0.01,
            metalness: 0.05, // Slight metallic sheen for premium feel
            ior: 2.4, // Starting at Diamond level refraction
            clearcoat: 1,
            clearcoatRoughness: 0.01,
            transparent: true,
            opacity: 0.99,
            color: new THREE.Color(0xffffff),
            attenuationColor: new THREE.Color(0xffffff),
            attenuationDistance: 0.12 // More intense depth perception
        });

        this.glassSlab = new THREE.Mesh(geometry, material);
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

    private animate(): void {
        this.animationFrameId = requestAnimationFrame(() => this.animate());

        // Smoothly rotate the glass background towards the target (mouse-based)
        if (this.glassSlab) {
            this.glassSlab.rotation.x += (this.targetRotation.x - this.glassSlab.rotation.x) * 0.05;
            this.glassSlab.rotation.y += (this.targetRotation.y - this.glassSlab.rotation.y) * 0.05;

            const time = Date.now() * 0.001;

            // "Elegant Morphing": Subtle breathing effect on refraction
            // Increased the range slightly for more visible "liquidity"
            const morphFactor = Math.sin(time * 0.4) * 0.3;
            (this.glassSlab.material as THREE.MeshPhysicalMaterial).ior = 2.4 + morphFactor;
            (this.glassSlab.material as THREE.MeshPhysicalMaterial).thickness = 6.0 + morphFactor * 3;

            // Liquid-like light movement
            if (this.pointLight) {
                this.pointLight.position.x = Math.sin(time * 0.5) * 3;
                this.pointLight.position.y = Math.cos(time * 0.3) * 1;
            }
        }

        this.renderer?.render(this.scene, this.camera);
    }

    private updateThreeColor(): void {
        if (!this.glassSlab || !this.pointLight) return;

        const tab = this.activeTab();
        const hexColor = this.TAB_COLORS[tab] || '#ffffff';
        const targetColor = new THREE.Color(hexColor);

        // Transition the light color
        this.pointLight.color.copy(targetColor);

        // Subtle color tint on the slab
        (this.glassSlab.material as THREE.MeshPhysicalMaterial).color
            .copy(targetColor)
            .lerp(new THREE.Color(0xffffff), 0.95);
    }

    private updateActiveTab(url: string): void {
        const segments = url.split('/').filter(s => !!s);
        const tab = segments.pop() || 'pulse';

        const hexColor = this.TAB_COLORS[tab];

        if (hexColor) {
            this.activeTab.set(tab);
            // SET GLOBAL THEME COLOR
            document.documentElement.style.setProperty('--active-tab-color', hexColor);
            document.documentElement.style.setProperty('--active-tab-glow', `${hexColor}40`); // 25% opacity

            this.updateThreeColor();
        }
    }
}