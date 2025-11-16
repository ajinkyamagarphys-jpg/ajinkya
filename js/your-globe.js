// Your Globe Component - Converted from React to Vanilla JS
class YourGlobe {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            width: '100%',
            height: '100vh',
            oceanColor: '#001a1a',
            dotColor: '#00ff88',
            glowColor: '#00ff88',
            transparent: true,
            dotSize: 2.0,
            autoRotate: true,
            ...options
        };

        // Three.js objects
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.globeMesh = null;
        this.glowMesh = null;
        this.points = null;
        this.controls = null;
        this.animId = null;
        this.dataFlowRays = [];

        // Animation state
        this.targetX = 0;
        this.targetY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.clock = new THREE.Clock();

        this.init();
    }

    // Convert lat/lon to 3D coordinates
    latLonToVector3(lon, lat, radius) {
        const latRad = (lat * Math.PI) / 180;
        const lonRad = (-lon * Math.PI) / 180; // negative lon to fix mirroring
        const x = radius * Math.cos(latRad) * Math.cos(lonRad);
        const y = radius * Math.sin(latRad);
        const z = radius * Math.cos(latRad) * Math.sin(lonRad);
        return new THREE.Vector3(x, y, z);
    }

    async init() {
        console.log('🌍 Initializing Your Globe...');

        const debugMode = window.location.search.includes('debug=globe');
        if (debugMode) {
            this.container.style.outline = '2px dashed rgba(15,157,88,0.6)';
            console.info('[Globe] debug mode enabled');
        }

        let widthPx = this.container.clientWidth;
        let heightPx = this.container.clientHeight;

        // Ensure container has size
        if (widthPx === 0 || heightPx === 0) {
            this.container.style.minHeight = this.container.style.minHeight || '480px';
            widthPx = this.container.clientWidth || 600;
            heightPx = this.container.clientHeight || 600;
        }

        // Setup renderer
        try {
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(widthPx, heightPx);
            this.renderer.setClearColor(0x000000, this.options.transparent ? 0 : 1);
            this.container.appendChild(this.renderer.domElement);
        } catch (err) {
            this.showFallback('WebGL unavailable - try another browser or enable hardware acceleration.');
            console.error('[Globe] WebGL renderer creation failed', err);
            return;
        }

        // Scene and camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, widthPx / heightPx, 0.1, 1000);
        this.camera.position.set(0, 0, 3.2);

        // Lights
        const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
        this.scene.add(hemi);
        const point = new THREE.PointLight(this.options.dotColor, 0.8);
        point.position.set(5, 5, 5);
        this.scene.add(point);

        // Create globe
        this.createGlobe();

        // Setup controls
        this.setupControls();

        // Load world data and create features
        try {
            await this.loadWorldData();
        } catch (err) {
            console.warn('[Globe] Map data loading failed, using basic features:', err);
            this.createBasicFeatures();
        }

        // Setup interactions
        this.setupMouseInteraction();
        this.setupResize();

        // Start animation
        this.animate();

        console.log('✅ Your Globe Ready!');
    }

    createGlobe() {
        const R = 1;

        // Ocean sphere
        const sphereGeo = new THREE.SphereGeometry(R, 64, 64);
        const sphereMat = new THREE.MeshPhongMaterial({
            color: this.options.oceanColor,
            shininess: 12,
            specular: 0x222222,
            transparent: false,
        });
        this.globeMesh = new THREE.Mesh(sphereGeo, sphereMat);
        this.scene.add(this.globeMesh);

        // Glow shell (slightly larger)
        const glowGeo = new THREE.SphereGeometry(R * 1.03, 64, 64);
        const glowMat = new THREE.MeshBasicMaterial({
            color: this.options.glowColor,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
        });
        this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
        this.scene.add(this.glowMesh);
    }

    setupControls() {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableZoom = false;
            this.controls.enablePan = false;
            this.controls.enableDamping = true;
            this.controls.rotateSpeed = 0.4;
            console.log('✅ OrbitControls initialized');
        } else {
            console.warn('⚠️ OrbitControls not available, using manual rotation only');
            // Manual rotation will work without controls
        }
    }

    async loadWorldData() {
        // Try local copy first, fall back to remote
        const localTopo = '/world-110m.json';
        const remoteTopo = 'https://unpkg.com/world-atlas@1/world/110m.json';
        const remoteGeoJSON = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';

        let worldData;
        try {
            // Try local file first
            const response = await fetch(localTopo);
            if (!response.ok) throw new Error('local not found');
            worldData = await response.json();
            
            console.info('[Globe] Local data loaded', worldData);
            
            // Check if it's GeoJSON or TopoJSON
            if (worldData.type === 'FeatureCollection') {
                // It's GeoJSON format
                console.info('[Globe] Processing GeoJSON format');
                this.createBoundaryPoints(worldData.features);
            } else if (worldData.objects && worldData.objects.countries) {
                // It's TopoJSON format
                console.info('[Globe] Processing TopoJSON format');
                const countries = topojson.feature(worldData, worldData.objects.countries);
                this.createBoundaryPoints(countries.features);
            } else {
                throw new Error('Unknown data format');
            }
        } catch (error) {
            console.warn('[Globe] Local data failed, trying remote TopoJSON:', error.message);
            
            try {
                // Try remote topojson
                const response = await fetch(remoteTopo);
                worldData = await response.json();
                const countries = topojson.feature(worldData, worldData.objects.countries);
                this.createBoundaryPoints(countries.features);
                console.info('[Globe] Remote TopoJSON loaded successfully');
            } catch (error2) {
                console.warn('[Globe] Remote TopoJSON failed, trying GeoJSON:', error2.message);
                
                try {
                    // Try remote geojson
                    const response = await fetch(remoteGeoJSON);
                    worldData = await response.json();
                    this.createBoundaryPoints(worldData.features);
                    console.info('[Globe] Remote GeoJSON loaded successfully');
                } catch (error3) {
                    console.error('[Globe] All data sources failed, using basic features');
                    this.createBasicFeatures();
                    return;
                }
            }
        }

        this.createDataFlowRays();
    }

    createBoundaryPoints(features) {
        const boundaryPositions = [];
        const R = 1;

        const pushBoundaryCoords = (coords) => {
            for (let i = 0; i < coords.length; i += 1) {
                const pair = coords[i];
                const lon = pair[0];
                const lat = pair[1];
                const v = this.latLonToVector3(lon, lat, R + 0.002);
                boundaryPositions.push(v.x, v.y, v.z);
            }
        };

        // Process only continent boundaries
        features.forEach((f) => {
            const geom = f.geometry;
            if (geom.type === 'Polygon') {
                pushBoundaryCoords(geom.coordinates[0]);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach((poly) => {
                    pushBoundaryCoords(poly[0]);
                });
            }
        });

        // Create boundary points
        if (boundaryPositions.length) {
            const boundAttr = new Float32Array(boundaryPositions);
            const boundGeo = new THREE.BufferGeometry();
            boundGeo.setAttribute('position', new THREE.BufferAttribute(boundAttr, 3));
            
            const glowTexture = this.createGlowTexture();
            const boundMat = new THREE.PointsMaterial({
                color: this.options.dotColor,
                map: glowTexture,
                size: this.options.dotSize * 0.008,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            
            this.points = new THREE.Points(boundGeo, boundMat);
            this.scene.add(this.points);
        }

        console.info('[Globe] boundary points created, count=', boundaryPositions.length / 3);
    }

    createBasicFeatures() {
        console.info('[Globe] Creating basic globe features (lat/lon grid)');
        const R = 1;
        const gridColor = this.options.dotColor;
        
        // Create latitude lines
        for (let lat = -80; lat <= 80; lat += 20) {
            const points = [];
            for (let lng = 0; lng <= 360; lng += 5) {
                const v = this.latLonToVector3(lng, lat, R + 0.002);
                points.push(v);
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: gridColor,
                    transparent: true,
                    opacity: 0.3
                });
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
            }
        }
        
        // Create longitude lines
        for (let lng = 0; lng < 180; lng += 20) {
            const points = [];
            for (let lat = -90; lat <= 90; lat += 5) {
                const v = this.latLonToVector3(lng, lat, R + 0.002);
                points.push(v);
            }
            
            if (points.length > 1) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: gridColor,
                    transparent: true,
                    opacity: 0.3
                });
                const line = new THREE.Line(geometry, material);
                this.scene.add(line);
            }
        }
        
        // Add some random dots to simulate cities
        const dotPositions = [];
        for (let i = 0; i < 100; i++) {
            const lat = (Math.random() - 0.5) * 160; // -80 to 80
            const lng = (Math.random() - 0.5) * 360; // -180 to 180
            const v = this.latLonToVector3(lng, lat, R + 0.003);
            dotPositions.push(v.x, v.y, v.z);
        }
        
        if (dotPositions.length) {
            const dotAttr = new Float32Array(dotPositions);
            const dotGeo = new THREE.BufferGeometry();
            dotGeo.setAttribute('position', new THREE.BufferAttribute(dotAttr, 3));
            
            const glowTexture = this.createGlowTexture();
            const dotMat = new THREE.PointsMaterial({
                color: this.options.dotColor,
                map: glowTexture,
                size: this.options.dotSize * 0.006,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            
            this.points = new THREE.Points(dotGeo, dotMat);
            this.scene.add(this.points);
        }
        
        // Still create data flow rays
        this.createDataFlowRays();
    }

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, '#88ff88');
        grad.addColorStop(0.4, '#44ff44');
        grad.addColorStop(1, 'rgba(0,255,136,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(canvas);
    }

    createDataFlowRays() {
        const R = 1;
        const connections = [
            { from: [77.2, 28.6], to: [-74.0, 40.7] }, // Delhi to NYC
            { from: [2.3, 48.9], to: [139.7, 35.7] }, // Paris to Tokyo
            { from: [-0.1, 51.5], to: [-43.2, -22.9] }, // London to Rio
            { from: [151.2, -33.9], to: [55.3, 25.3] }, // Sydney to Dubai
            { from: [-122.4, 37.8], to: [116.4, 39.9] }, // SF to Beijing
            { from: [12.5, 41.9], to: [72.8, 19.0] }, // Rome to Mumbai
            { from: [103.8, 1.3], to: [-99.1, 19.4] }, // Singapore to Mexico City
            { from: [31.2, 30.0], to: [174.8, -41.3] }, // Cairo to Wellington
            { from: [-58.4, -34.6], to: [37.6, 55.8] }, // Buenos Aires to Moscow
            { from: [126.9, 37.6], to: [13.4, 52.5] }, // Seoul to Berlin
        ];

        connections.forEach((connection, index) => {
            const startPos = this.latLonToVector3(connection.from[0], connection.from[1], R + 0.01);
            const endPos = this.latLonToVector3(connection.to[0], connection.to[1], R + 0.01);

            // Create parabolic arc above the globe
            const distance = startPos.distanceTo(endPos);
            const arcHeight = Math.max(0.3, distance * 0.4);

            const midPoint = new THREE.Vector3();
            midPoint.addVectors(startPos, endPos).multiplyScalar(0.5);
            midPoint.normalize().multiplyScalar(R + arcHeight);

            // Create smooth curve
            const curve = new THREE.QuadraticBezierCurve3(startPos, midPoint, endPos);
            const points = curve.getPoints(60);

            // Create geometry for the ray
            const rayGeometry = new THREE.BufferGeometry().setFromPoints(points);

            // Create animated material with white color
            const rayMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                linewidth: 4,
            });

            const rayLine = new THREE.Line(rayGeometry, rayMaterial);

            // Store animation data
            rayLine.userData = {
                startTime: index * 0.3,
                duration: 2.5,
                delay: 2,
                points: points,
                originalGeometry: rayGeometry.clone(),
            };

            this.dataFlowRays.push(rayLine);
            this.scene.add(rayLine);
        });
    }

    setupMouseInteraction() {
        const onMouseMove = (e) => {
            const rect = this.container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
            this.targetY = x * 0.5;
            this.targetX = y * 0.25;
        };

        this.container.addEventListener('mousemove', onMouseMove);
        this.onMouseMove = onMouseMove; // Store for cleanup
    }

    setupResize() {
        const onResize = () => {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.renderer.setSize(w, h);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        };

        window.addEventListener('resize', onResize);
        this.onResize = onResize; // Store for cleanup
    }

    animate() {
        this.animId = requestAnimationFrame(() => this.animate());
        const dt = this.clock.getDelta();

        // Smooth interpolate mouse interaction
        this.currentX += (this.targetX - this.currentX) * 0.07;
        this.currentY += (this.targetY - this.currentY) * 0.07;

        if (this.globeMesh) {
            this.globeMesh.rotation.x = this.currentX;
            this.globeMesh.rotation.y += this.options.autoRotate ? 0.002 : 0;
        }
        if (this.glowMesh) {
            this.glowMesh.rotation.x = this.currentX;
            this.glowMesh.rotation.y += this.options.autoRotate ? 0.002 : 0;
        }
        if (this.points) {
            this.points.rotation.x = this.currentX;
            this.points.rotation.y += this.options.autoRotate ? 0.002 : 0;
            // Pulsing animation
            const pulse = (Math.sin(this.clock.getElapsedTime() * 2) + 1) * 0.5;
            this.points.material.opacity = 0.6 + pulse * 0.4;
            this.points.material.size = this.options.dotSize * 0.008 * (0.8 + pulse * 0.4);
        }

        // Animate data flow rays
        const currentTime = this.clock.getElapsedTime();
        this.dataFlowRays.forEach((ray) => {
            const cycleTime = ray.userData.duration + ray.userData.delay;
            const elapsed = (currentTime - ray.userData.startTime) % cycleTime;

            if (elapsed < ray.userData.duration) {
                // Ray is active - show progressive drawing
                const progress = elapsed / ray.userData.duration;
                const totalPoints = ray.userData.points.length;
                const visiblePoints = Math.floor(progress * totalPoints);

                if (visiblePoints > 1) {
                    const visibleGeometry = new THREE.BufferGeometry().setFromPoints(
                        ray.userData.points.slice(0, visiblePoints)
                    );
                    ray.geometry.dispose();
                    ray.geometry = visibleGeometry;

                    // Fade in and out
                    let alpha = 1;
                    if (progress < 0.1) alpha = progress / 0.1;
                    else if (progress > 0.8) alpha = (1 - progress) / 0.2;

                    ray.material.opacity = alpha * 0.9;
                } else {
                    ray.material.opacity = 0;
                }
            } else {
                // Ray is in delay phase
                ray.material.opacity = 0;
                ray.geometry.dispose();
                ray.geometry = ray.userData.originalGeometry.clone();
            }

            // Apply globe rotation to rays
            ray.rotation.x = this.currentX;
            ray.rotation.y += this.options.autoRotate ? 0.002 : 0;
        });

        if (this.controls) {
            this.controls.update();
        }
        this.renderer.render(this.scene, this.camera);
    }

    showFallback(message) {
        const overlay = document.createElement('div');
        overlay.className = 'globe-fallback';
        overlay.style.cssText = `
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.45);
            color: #bff3c9;
            font-size: 1rem;
            z-index: 20;
            padding: 1rem;
            text-align: center;
        `;
        overlay.textContent = message;
        this.container.appendChild(overlay);
    }

    destroy() {
        if (this.animId) {
            cancelAnimationFrame(this.animId);
        }
        if (this.onMouseMove) {
            this.container.removeEventListener('mousemove', this.onMouseMove);
        }
        if (this.onResize) {
            window.removeEventListener('resize', this.onResize);
        }
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        // Clean up data flow rays
        this.dataFlowRays.forEach(ray => {
            this.scene.remove(ray);
            ray.geometry.dispose();
            ray.material.dispose();
            if (ray.userData.originalGeometry) ray.userData.originalGeometry.dispose();
        });

        // Clean up scene
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach((m) => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
    }
}

// Add globe CSS
const globeCSS = `
    .globe-wrapper {
        position: relative;
        overflow: hidden;
        display: block;
        min-height: 480px;
    }
    
    .globe-wrapper canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
    
    .globe-fallback {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.45);
        color: #bff3c9;
        font-size: 1rem;
        z-index: 20;
        padding: 1rem;
        text-align: center;
    }
`;

// Inject CSS
if (!document.querySelector('#globe-styles')) {
    const style = document.createElement('style');
    style.id = 'globe-styles';
    style.textContent = globeCSS;
    document.head.appendChild(style);
}

// Initialize globe with proper dependency checking
function initializeGlobe() {
    const container = document.getElementById('globe-container');
    
    // Check all dependencies
    const dependencies = {
        THREE: typeof THREE !== 'undefined',
        topojson: typeof topojson !== 'undefined',
        container: !!container
    };
    
    console.log('🔍 Dependencies check:', dependencies);
    
    if (dependencies.THREE && dependencies.topojson && dependencies.container) {
        console.log('🚀 All dependencies ready, starting globe...');
        container.innerHTML = ''; // Clear any existing content
        container.classList.add('globe-wrapper');
        
        const globe = new YourGlobe(container, {
            oceanColor: '#001a1a',
            dotColor: '#00ff88',
            glowColor: '#00ff88',
            transparent: true,
            dotSize: 1.5,
            autoRotate: true
        });
        
        window.globeInstance = globe; // For debugging
        return true;
    } else {
        console.warn('⚠️ Missing dependencies, will retry...', dependencies);
        return false;
    }
}

// Try to initialize with multiple fallbacks
let initAttempts = 0;
const maxAttempts = 10;

function tryInitialize() {
    initAttempts++;
    
    if (initializeGlobe()) {
        console.log('✅ Globe initialized successfully!');
        return;
    }
    
    if (initAttempts < maxAttempts) {
        console.log(`🔄 Retry ${initAttempts}/${maxAttempts} in 200ms...`);
        setTimeout(tryInitialize, 200);
    } else {
        console.error('❌ Failed to initialize globe after', maxAttempts, 'attempts');
        const container = document.getElementById('globe-container');
        if (container) {
            container.innerHTML = '<div style="color: #ff6b6b; text-align: center; padding: 2rem;">Failed to load 3D globe. Please refresh the page.</div>';
        }
    }
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(tryInitialize, 100);
});

// Also try on window load as backup
window.addEventListener('load', () => {
    if (!window.globeInstance) {
        setTimeout(tryInitialize, 100);
    }
});