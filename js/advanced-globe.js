// Advanced Globe with Country Borders and Effects
class AdvancedGlobe {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.globe = null;
        this.animationId = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.init();
    }

    async init() {
        console.log('🌍 Initializing Advanced Globe...');
        
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            2000
        );
        this.camera.position.set(0, 0, 300);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Create globe
        await this.createGlobe();
        this.addLights();
        this.addAtmosphere();
        this.addStars();
        this.setupControls();
        
        // Load world data
        try {
            await this.loadWorldData();
        } catch (error) {
            console.log('Using basic globe features');
            this.addBasicFeatures();
        }
        
        this.setupEventListeners();
        this.animate();
        
        console.log('✅ Advanced Globe Ready!');
    }

    async createGlobe() {
        // Main globe
        const geometry = new THREE.SphereGeometry(100, 64, 64);
        
        // Ocean material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                varying vec3 vPosition;
                varying vec2 vUv;
                void main() {
                    vPosition = position;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec3 vPosition;
                varying vec2 vUv;
                
                void main() {
                    vec3 oceanColor = vec3(0.1, 0.3, 0.6);
                    float wave = sin(vUv.x * 20.0 + time) * sin(vUv.y * 20.0 + time) * 0.02;
                    oceanColor += wave;
                    
                    gl_FragColor = vec4(oceanColor, 0.9);
                }
            `,
            transparent: true
        });
        
        this.globe = new THREE.Mesh(geometry, material);
        this.scene.add(this.globe);
    }

    addAtmosphere() {
        // Atmosphere glow
        const atmosphereGeometry = new THREE.SphereGeometry(105, 32, 32);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });
        
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
    }

    addStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 2000;
        const positions = new Float32Array(starsCount * 3);
        
        for (let i = 0; i < starsCount * 3; i++) {
            positions[i] = (Math.random() - 0.5) * 2000;
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.8
        });
        
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }

    async loadWorldData() {
        const response = await fetch('/world-110m.json');
        const worldData = await response.json();
        
        if (worldData.features) {
            this.addCountryBorders(worldData);
        }
    }

    addCountryBorders(worldData) {
        const borderGroup = new THREE.Group();
        
        worldData.features.forEach(country => {
            if (country.geometry.type === 'Polygon') {
                this.addPolygon(country.geometry.coordinates[0], borderGroup);
            } else if (country.geometry.type === 'MultiPolygon') {
                country.geometry.coordinates.forEach(polygon => {
                    this.addPolygon(polygon[0], borderGroup);
                });
            }
        });
        
        this.scene.add(borderGroup);
    }

    addPolygon(coordinates, group) {
        const points = [];
        
        coordinates.forEach(coord => {
            const [lng, lat] = coord;
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lng + 180) * (Math.PI / 180);
            
            const x = 102 * Math.sin(phi) * Math.cos(theta);
            const y = 102 * Math.cos(phi);
            const z = 102 * Math.sin(phi) * Math.sin(theta);
            
            points.push(new THREE.Vector3(x, y, z));
        });
        
        if (points.length > 2) {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.6
            });
            
            const line = new THREE.Line(geometry, material);
            group.add(line);
        }
    }

    addBasicFeatures() {
        // Add latitude lines
        for (let lat = -80; lat <= 80; lat += 20) {
            const points = [];
            for (let lng = 0; lng <= 360; lng += 5) {
                const phi = (90 - lat) * (Math.PI / 180);
                const theta = lng * (Math.PI / 180);
                
                const x = 102 * Math.sin(phi) * Math.cos(theta);
                const y = 102 * Math.cos(phi);
                const z = 102 * Math.sin(phi) * Math.sin(theta);
                
                points.push(new THREE.Vector3(x, y, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.4
            });
            
            const line = new THREE.Line(geometry, material);
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
            const material = new THREE.LineBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.4
            });
            
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
        }
    }

    addLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(200, 200, 200);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Blue accent light
        const blueLight = new THREE.PointLight(0x0088ff, 0.5, 400);
        blueLight.position.set(-100, 0, 100);
        this.scene.add(blueLight);

        // Green accent light
        const greenLight = new THREE.PointLight(0x00ff88, 0.3, 400);
        greenLight.position.set(100, 0, -100);
        this.scene.add(greenLight);
    }

    setupControls() {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.enableZoom = false;
            this.controls.enablePan = false;
            this.controls.autoRotate = true;
            this.controls.autoRotateSpeed = 0.3;
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse interaction
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        });

        // Scroll-based opacity
        window.addEventListener('scroll', () => this.handleScroll());
    }

    handleScroll() {
        const heroSection = document.querySelector('.hero-section');
        if (!heroSection) return;

        const heroHeight = heroSection.offsetHeight;
        const scrolled = window.pageYOffset;
        
        let opacity = 1;
        if (scrolled > heroHeight * 0.2) {
            const fadeStart = heroHeight * 0.2;
            const fadeEnd = heroHeight * 0.8;
            const fadeProgress = Math.min((scrolled - fadeStart) / (fadeEnd - fadeStart), 1);
            opacity = 1 - fadeProgress;
        }
        
        this.container.style.opacity = opacity;
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Update time uniform for ocean waves
        if (this.globe && this.globe.material.uniforms) {
            this.globe.material.uniforms.time.value += 0.01;
        }

        // Auto rotate
        if (this.globe) {
            this.globe.rotation.y += 0.002;
        }

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
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
        if (this.renderer) {
            this.container.removeChild(this.renderer.domElement);
        }
        if (this.controls) {
            this.controls.dispose();
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const container = document.getElementById('globe-container');
        if (container && typeof THREE !== 'undefined') {
            // Remove test globe first
            container.innerHTML = '';
            new AdvancedGlobe(container);
        }
    }, 100);
});