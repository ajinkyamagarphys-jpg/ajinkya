// Simple Working Globe - Based on your component but fixed
class SimpleGlobe {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            oceanColor: '#001a1a',
            dotColor: '#00ff88',
            glowColor: '#00ff88',
            transparent: true,
            dotSize: 1.5,
            autoRotate: true,
            ...options
        };

        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.globeMesh = null;
        this.glowMesh = null;
        this.points = null;
        this.controls = null;
        this.animId = null;
        this.dataFlowRays = [];
        this.clock = new THREE.Clock();

        this.init();
    }

    latLonToVector3(lon, lat, radius) {
        const latRad = (lat * Math.PI) / 180;
        const lonRad = (-lon * Math.PI) / 180;
        const x = radius * Math.cos(latRad) * Math.cos(lonRad);
        const y = radius * Math.sin(latRad);
        const z = radius * Math.cos(latRad) * Math.sin(lonRad);
        return new THREE.Vector3(x, y, z);
    }

    async init() {
        console.log('🌍 Initializing Simple Globe...');

        let widthPx = this.container.clientWidth;
        let heightPx = this.container.clientHeight;

        if (widthPx === 0 || heightPx === 0) {
            this.container.style.minHeight = '480px';
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
            this.showError('WebGL unavailable - try another browser');
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
        this.setupControls();

        // Load world data
        await this.loadWorldData();

        // Setup interactions
        this.setupEventListeners();
        this.animate();

        console.log('✅ Simple Globe Ready!');
    }

    createGlobe() {
        const R = 1;

        // Ocean sphere
        const sphereGeo = new THREE.SphereGeometry(R, 64, 64);
        const sphereMat = new THREE.MeshPhongMaterial({
            color: this.options.oceanColor,
            shininess: 12,
            specular: 0x222222,
        });
        this.globeMesh = new THREE.Mesh(sphereGeo, sphereMat);
        this.scene.add(this.globeMesh);

        // Glow shell
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
            console.warn('⚠️ OrbitControls not available');
        }
    }

    async loadWorldData() {
        try {
            console.log('📡 Loading world data...');
            
            // Try local file first
            let response = await fetch('/world-110m.json');
            let worldData = await response.json();
            
            console.log('📊 Data loaded:', worldData.type || 'Unknown type');
            
            // Check data format
            if (worldData.type === 'FeatureCollection') {
                // GeoJSON format
                this.processGeoJSON(worldData.features);
            } else if (worldData.objects && worldData.objects.countries) {
                // TopoJSON format
                const countries = topojson.feature(worldData, worldData.objects.countries);
                this.processGeoJSON(countries.features);
            } else {
                console.warn('Unknown data format, using fallback');
                this.createFallbackFeatures();
            }
            
        } catch (error) {
            console.warn('Local data failed, trying remote:', error.message);
            
            try {
                // Try remote as backup
                let response = await fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
                let worldData = await response.json();
                this.processGeoJSON(worldData.features);
            } catch (error2) {
                console.warn('Remote data failed too:', error2.message);
                this.createFallbackFeatures();
            }
        }
    }

    processGeoJSON(features) {
        console.log(`🗺️ Processing ${features.length} countries`);
        
        const boundaryPositions = [];
        const R = 1;

        features.forEach((feature) => {
            if (!feature.geometry || !feature.geometry.coordinates) return;
            
            const geom = feature.geometry;
            
            if (geom.type === 'Polygon') {
                this.addPolygonCoords(geom.coordinates[0], boundaryPositions, R);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach(polygon => {
                    this.addPolygonCoords(polygon[0], boundaryPositions, R);
                });
            }
        });

        this.createBoundaryPoints(boundaryPositions);
        this.createDataFlowRays();
    }

    addPolygonCoords(coordinates, positions, R) {
        coordinates.forEach(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
                const [lng, lat] = coord;
                if (typeof lng === 'number' && typeof lat === 'number') {
                    const v = this.latLonToVector3(lng, lat, R + 0.002);
                    positions.push(v.x, v.y, v.z);
                }
            }
        });
    }

    createBoundaryPoints(boundaryPositions) {
        if (boundaryPositions.length === 0) {
            console.warn('No boundary positions found');
            this.createFallbackFeatures();
            return;
        }

        console.log(`✨ Creating ${boundaryPositions.length / 3} boundary points`);

        const boundAttr = new Float32Array(boundaryPositions);
        const boundGeo = new THREE.BufferGeometry();
        boundGeo.setAttribute('position', new THREE.BufferAttribute(boundAttr, 3));

        // Create simple dot material
        const boundMat = new THREE.PointsMaterial({
            color: this.options.dotColor,
            size: 0.01,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8,
        });

        this.points = new THREE.Points(boundGeo, boundMat);
        this.scene.add(this.points);
    }

    createFallbackFeatures() {
        console.log('🔧 Creating fallback lat/lon grid');
        
        const R = 1;
        const gridPositions = [];

        // Create latitude lines
        for (let lat = -80; lat <= 80; lat += 20) {
            for (let lng = 0; lng <= 360; lng += 10) {
                const v = this.latLonToVector3(lng, lat, R + 0.002);
                gridPositions.push(v.x, v.y, v.z);
            }
        }

        // Create longitude lines
        for (let lng = 0; lng < 180; lng += 20) {
            for (let lat = -90; lat <= 90; lat += 10) {
                const v = this.latLonToVector3(lng, lat, R + 0.002);
                gridPositions.push(v.x, v.y, v.z);
            }
        }

        this.createBoundaryPoints(gridPositions);
        this.createDataFlowRays();
    }

    createDataFlowRays() {
        console.log('⚡ Creating data flow rays');
        
        const R = 1;
        const connections = [
            { from: [77.2, 28.6], to: [-74.0, 40.7] }, // Delhi to NYC
            { from: [2.3, 48.9], to: [139.7, 35.7] },   // Paris to Tokyo
            { from: [-0.1, 51.5], to: [-43.2, -22.9] }, // London to Rio
            { from: [151.2, -33.9], to: [55.3, 25.3] }, // Sydney to Dubai
            { from: [-122.4, 37.8], to: [116.4, 39.9] }, // SF to Beijing
        ];

        connections.forEach((connection, index) => {
            const startPos = this.latLonToVector3(connection.from[0], connection.from[1], R + 0.01);
            const endPos = this.latLonToVector3(connection.to[0], connection.to[1], R + 0.01);

            // Create arc
            const distance = startPos.distanceTo(endPos);
            const arcHeight = Math.max(0.3, distance * 0.4);

            const midPoint = new THREE.Vector3();
            midPoint.addVectors(startPos, endPos).multiplyScalar(0.5);
            midPoint.normalize().multiplyScalar(R + arcHeight);

            const curve = new THREE.QuadraticBezierCurve3(startPos, midPoint, endPos);
            const points = curve.getPoints(50);

            const rayGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const rayMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
            });

            const rayLine = new THREE.Line(rayGeometry, rayMaterial);
            rayLine.userData = {
                startTime: index * 0.5,
                duration: 3,
                delay: 2,
            };

            this.dataFlowRays.push(rayLine);
            this.scene.add(rayLine);
        });
    }

    setupEventListeners() {
        // Mouse interaction
        this.targetX = 0;
        this.targetY = 0;
        this.currentX = 0;
        this.currentY = 0;

        const onMouseMove = (e) => {
            const rect = this.container.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
            this.targetY = x * 0.3;
            this.targetX = y * 0.15;
        };

        this.container.addEventListener('mousemove', onMouseMove);
        this.onMouseMove = onMouseMove;

        // Resize
        const onResize = () => {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.renderer.setSize(w, h);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        };

        window.addEventListener('resize', onResize);
        this.onResize = onResize;
    }

    animate() {
        this.animId = requestAnimationFrame(() => this.animate());

        // Mouse interaction
        this.currentX += (this.targetX - this.currentX) * 0.05;
        this.currentY += (this.targetY - this.currentY) * 0.05;

        // Globe rotation starting from India (77.2090° E, 28.6139° N)
        const indiaLongitude = 77.2090; // Delhi longitude
        const initialRotationY = (indiaLongitude * Math.PI) / 180; // Convert to radians
        
        if (this.globeMesh) {
            this.globeMesh.rotation.x = this.currentX;
            this.globeMesh.rotation.y = initialRotationY + (this.options.autoRotate ? this.clock.getElapsedTime() * 0.1 : 0) + this.currentY;
        }
        if (this.glowMesh) {
            this.glowMesh.rotation.x = this.currentX;
            this.glowMesh.rotation.y = initialRotationY + (this.options.autoRotate ? this.clock.getElapsedTime() * 0.1 : 0) + this.currentY;
        }
        if (this.points) {
            this.points.rotation.x = this.currentX;
            this.points.rotation.y = initialRotationY + (this.options.autoRotate ? this.clock.getElapsedTime() * 0.1 : 0) + this.currentY;
            
            // Pulsing effect
            const pulse = Math.sin(this.clock.getElapsedTime() * 2) * 0.5 + 0.5;
            this.points.material.opacity = 0.5 + pulse * 0.3;
        }

        // Animate data rays
        const currentTime = this.clock.getElapsedTime();
        this.dataFlowRays.forEach((ray) => {
            const cycleTime = ray.userData.duration + ray.userData.delay;
            const elapsed = (currentTime - ray.userData.startTime) % cycleTime;

            if (elapsed < ray.userData.duration) {
                const progress = elapsed / ray.userData.duration;
                let alpha = 1;
                if (progress < 0.2) alpha = progress / 0.2;
                else if (progress > 0.7) alpha = (1 - progress) / 0.3;
                ray.material.opacity = alpha * 0.8;
            } else {
                ray.material.opacity = 0;
            }

            ray.rotation.x = this.currentX;
            ray.rotation.y = initialRotationY + (this.options.autoRotate ? this.clock.getElapsedTime() * 0.1 : 0) + this.currentY;
        });

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    showError(message) {
        const div = document.createElement('div');
        div.style.cssText = `
            position: absolute; inset: 0; display: flex; align-items: center;
            justify-content: center; background: rgba(0,0,0,0.7); color: #ff6b6b;
            font-size: 14px; text-align: center; padding: 1rem;
        `;
        div.textContent = message;
        this.container.appendChild(div);
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        if (this.onMouseMove) this.container.removeEventListener('mousemove', this.onMouseMove);
        if (this.onResize) window.removeEventListener('resize', this.onResize);
        if (this.controls) this.controls.dispose();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }
}

// Initialize
function initializeSimpleGlobe() {
    const container = document.getElementById('globe-container');
    
    if (!container) {
        console.error('❌ Globe container not found');
        return false;
    }

    if (typeof THREE === 'undefined') {
        console.error('❌ THREE.js not loaded');
        return false;
    }

    console.log('🚀 Starting Simple Globe...');
    container.innerHTML = '';
    container.classList.add('globe-wrapper');

    const globe = new SimpleGlobe(container, {
        oceanColor: '#001a1a',
        dotColor: '#00ff88',
        glowColor: '#00ff88',
        transparent: true,
        dotSize: 1.5,
        autoRotate: true
    });

    window.globeInstance = globe;
    return true;
}

// Start when ready
let attempts = 0;
function tryInit() {
    attempts++;
    if (initializeSimpleGlobe()) {
        console.log('✅ Globe ready!');
    } else if (attempts < 5) {
        console.log(`🔄 Retry ${attempts}/5...`);
        setTimeout(tryInit, 300);
    } else {
        console.error('❌ Failed to initialize globe');
    }
}

document.addEventListener('DOMContentLoaded', () => setTimeout(tryInit, 100));
window.addEventListener('load', () => setTimeout(tryInit, 200));