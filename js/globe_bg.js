// Interactive 3D Globe Background with Three.js
class GlobeBackground {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.globe = null;
        this.controls = null;
        this.animationId = null;
        this.isVisible = true;
        
        console.log('🌍 Globe constructor called with container:', container);
        
        // Add a visible test div first
        const testDiv = document.createElement('div');
        testDiv.style.position = 'absolute';
        testDiv.style.top = '50px';
        testDiv.style.left = '50px';
        testDiv.style.background = 'red';
        testDiv.style.color = 'white';
        testDiv.style.padding = '10px';
        testDiv.style.zIndex = '1000';
        testDiv.textContent = 'Globe Test Marker';
        container.appendChild(testDiv);
        
        this.init();
        this.setupScrollHandler();
    }

    async init() {
        // Check if Three.js is available
        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded');
            return;
        }

        console.log('🌍 Initializing Globe Background...');

        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 200);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true,
            antialias: true 
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0);
        this.container.appendChild(this.renderer.domElement);

        console.log('✅ Globe renderer created');

        // Create globe
        await this.createGlobe();

        // Add lights
        this.addLights();

        console.log('✅ Globe lights added');

        // Add controls (optional - for interaction)
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableZoom = false;
            this.controls.enablePan = false;
            this.controls.autoRotate = true;
            this.controls.autoRotateSpeed = 0.5;
            console.log('✅ Globe controls added');
        } else {
            console.log('⚠️ OrbitControls not available, using basic rotation');
        }

        // Handle resize
        window.addEventListener('resize', () => this.handleResize());

        // Start animation
        this.animate();
        console.log('🚀 Globe animation started!');
    }

    async createGlobe() {
        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(120, 64, 64);

        // Create material with better visibility
        const material = new THREE.MeshPhongMaterial({
            transparent: true,
            opacity: 0.9,
            color: 0x0088ff,
            wireframe: false,
            shininess: 100,
            emissive: 0x002244
        });

        // Create globe mesh
        this.globe = new THREE.Mesh(geometry, material);
        this.scene.add(this.globe);

        console.log('✅ Globe created with size 120');

        // Add basic features immediately
        this.addBasicGlobeFeatures();

        // Try to load world data (but don't wait for it)
        this.loadWorldData().catch(() => {
            console.log('Using basic globe features only');
        });
    }

    async loadWorldData() {
        // Try to load world-110m.json
        try {
            const response = await fetch('/world-110m.json');
            if (!response.ok) {
                throw new Error('World data not found');
            }
            
            const worldData = await response.json();
            this.addCountryBorders(worldData);
        } catch (error) {
            console.log('World data not available, using basic globe features');
            this.addBasicGlobeFeatures();
        }
    }

    addCountryBorders(worldData) {
        // This is a simplified version - you'll need topojson library for full implementation
        const borderMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.7
        });

        // Add some basic lat/long lines for now
        this.addLatLongLines();
    }

    addLatLongLines() {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.3
        });

        // Add latitude lines
        for (let lat = -80; lat <= 80; lat += 20) {
            const points = [];
            for (let lng = 0; lng <= 360; lng += 10) {
                const phi = (90 - lat) * (Math.PI / 180);
                const theta = lng * (Math.PI / 180);
                
                const x = 102 * Math.sin(phi) * Math.cos(theta);
                const y = 102 * Math.cos(phi);
                const z = 102 * Math.sin(phi) * Math.sin(theta);
                
                points.push(new THREE.Vector3(x, y, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.scene.add(line);
        }

        // Add longitude lines
        for (let lng = 0; lng < 180; lng += 20) {
            const points = [];
            for (let lat = -90; lat <= 90; lat += 5) {
                const phi = (90 - lat) * (Math.PI / 180);
                const theta = lng * (Math.PI / 180);
                
                const x = 102 * Math.sin(phi) * Math.cos(theta);
                const y = 102 * Math.cos(phi);
                const z = 102 * Math.sin(phi) * Math.sin(theta);
                
                points.push(new THREE.Vector3(x, y, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.scene.add(line);
        }
    }

    addBasicGlobeFeatures() {
        // Add some random dots to represent cities/points
        const dotGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < 50; i++) {
            const dot = new THREE.Mesh(dotGeometry, dotMaterial);
            
            // Random position on sphere surface
            const phi = Math.acos(-1 + (2 * Math.random()));
            const theta = Math.random() * Math.PI * 2;
            
            dot.position.x = 105 * Math.sin(phi) * Math.cos(theta);
            dot.position.y = 105 * Math.cos(phi);
            dot.position.z = 105 * Math.sin(phi) * Math.sin(theta);
            
            this.scene.add(dot);
        }

        this.addLatLongLines();
    }

    addLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(200, 200, 200);
        this.scene.add(directionalLight);

        // Point light for glow effect
        const pointLight = new THREE.PointLight(0x00ff88, 0.5, 300);
        pointLight.position.set(0, 0, 150);
        this.scene.add(pointLight);
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        if (this.globe && this.isVisible) {
            // Auto rotate the globe
            this.globe.rotation.y += 0.005;
        }

        if (this.controls) {
            this.controls.update();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    setupScrollHandler() {
        const heroSection = document.querySelector('.hero-section') || document.querySelector('.hero');
        if (!heroSection) return;

        window.addEventListener('scroll', () => {
            const heroRect = heroSection.getBoundingClientRect();
            const heroHeight = heroSection.offsetHeight;
            const scrolled = window.pageYOffset;
            
            // Calculate fade based on scroll position
            let opacity = 1;
            
            if (scrolled > heroHeight * 0.2) {
                const fadeStart = heroHeight * 0.2;
                const fadeEnd = heroHeight * 0.8;
                const fadeProgress = Math.min((scrolled - fadeStart) / (fadeEnd - fadeStart), 1);
                opacity = 1 - fadeProgress;
            }
            
            this.setOpacity(opacity);
        });
    }

    setOpacity(opacity) {
        if (this.container) {
            this.container.style.opacity = opacity;
            this.isVisible = opacity > 0.1;
        }
    }

    handleResize() {
        if (!this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.renderer && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
        }

        if (this.controls) {
            this.controls.dispose();
        }

        // Clean up Three.js objects
        if (this.scene) {
            this.scene.clear();
        }

        window.removeEventListener('resize', this.handleResize);
    }
}

// Initialize globe when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM ready, looking for globe container...');
    
    const globeContainer = document.getElementById('globe-container');
    if (globeContainer) {
        console.log('✅ Globe container found:', globeContainer);
        console.log('Container dimensions:', globeContainer.offsetWidth, 'x', globeContainer.offsetHeight);
        
        // Wait a bit for Three.js to load
        setTimeout(() => {
            console.log('🌍 Starting globe initialization...');
            try {
                new GlobeBackground(globeContainer);
            } catch (error) {
                console.error('❌ Globe initialization failed:', error);
            }
        }, 500);
    } else {
        console.error('❌ Globe container not found!');
    }
});

// Also try when window loads
window.addEventListener('load', () => {
    console.log('🔄 Window loaded, checking globe again...');
    if (!document.querySelector('#globe-container canvas')) {
        const globeContainer = document.getElementById('globe-container');
        if (globeContainer && typeof THREE !== 'undefined') {
            console.log('🔄 Retry globe creation...');
            new GlobeBackground(globeContainer);
        }
    }
});

// Export for use in other files
window.GlobeBackground = GlobeBackground;
