// Simple Test Globe - Just to verify Three.js is working
function createSimpleTestGlobe() {
    console.log('🔧 Creating simple test globe...');
    
    const container = document.getElementById('globe-container');
    if (!container) {
        console.error('❌ No globe container found');
        return;
    }
    
    if (typeof THREE === 'undefined') {
        console.error('❌ THREE.js not loaded');
        return;
    }
    
    console.log('✅ THREE.js is available');
    
    // Create a simple colored div first
    const testDiv = document.createElement('div');
    testDiv.style.position = 'absolute';
    testDiv.style.top = '50%';
    testDiv.style.left = '50%';
    testDiv.style.transform = 'translate(-50%, -50%)';
    testDiv.style.width = '200px';
    testDiv.style.height = '200px';
    testDiv.style.background = 'linear-gradient(45deg, #00ff88, #0088ff)';
    testDiv.style.borderRadius = '50%';
    testDiv.style.boxShadow = '0 0 50px rgba(0, 255, 136, 0.5)';
    testDiv.style.animation = 'spin 10s linear infinite';
    testDiv.style.display = 'flex';
    testDiv.style.alignItems = 'center';
    testDiv.style.justifyContent = 'center';
    testDiv.style.color = 'white';
    testDiv.style.fontSize = '16px';
    testDiv.style.fontWeight = 'bold';
    testDiv.textContent = '🌍 GLOBE';
    
    container.appendChild(testDiv);
    
    // Add CSS animation
    if (!document.querySelector('#globe-animation-style')) {
        const style = document.createElement('style');
        style.id = 'globe-animation-style';
        style.textContent = `
            @keyframes spin {
                from { transform: translate(-50%, -50%) rotate(0deg); }
                to { transform: translate(-50%, -50%) rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('✅ Test globe created!');
    
    // Try to create real Three.js globe after 1 second
    setTimeout(() => {
        try {
            createReal3DGlobe(container);
            testDiv.style.display = 'none'; // Hide test div
        } catch (error) {
            console.error('❌ Real globe failed:', error);
        }
    }, 1000);
}

function createReal3DGlobe(container) {
    console.log('🌍 Creating real 3D globe...');
    
    // Scene
    const scene = new THREE.Scene();
    
    // Camera
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 200;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    
    // Globe geometry and material
    const geometry = new THREE.SphereGeometry(60, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.8,
        shininess: 100
    });
    
    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);
    
    // Add wireframe overlay
    const wireframeGeometry = new THREE.SphereGeometry(61, 16, 16);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);
    
    console.log('✅ Real 3D globe created!');
    
    // Animation
    function animate() {
        requestAnimationFrame(animate);
        
        globe.rotation.y += 0.005;
        wireframe.rotation.y += 0.003;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    // Handle resize
    function handleResize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    window.addEventListener('resize', handleResize);
}

// Initialize when ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(createSimpleTestGlobe, 100);
});

window.addEventListener('load', () => {
    setTimeout(createSimpleTestGlobe, 200);
});