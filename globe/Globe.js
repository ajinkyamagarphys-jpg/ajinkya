// Vanilla JavaScript Globe Component
// Usage: new Globe(container, options)

class Globe {
  constructor(container, options = {}) {
    this.container = container
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
    }
    
    this.renderer = null
    this.scene = null
    this.camera = null
    this.globeMesh = null
    this.glowMesh = null
    this.points = null
    this.controls = null
    this.dataFlowRays = []
    this.animId = null
    this.clock = new THREE.Clock()
    
    this.init()
  }

  latLonToVector3(lon, lat, radius) {
    const latRad = (lat * Math.PI) / 180
    const lonRad = (-lon * Math.PI) / 180  // negative lon to fix mirroring
    const x = radius * Math.cos(latRad) * Math.cos(lonRad)
    const y = radius * Math.sin(latRad)
    const z = radius * Math.cos(latRad) * Math.sin(lonRad)
    return new THREE.Vector3(x, y, z)
  }

  init() {
    if (!this.container) return

    // Set container styles
    this.container.style.position = 'relative'
    this.container.style.overflow = 'hidden'
    this.container.style.display = 'block'
    this.container.style.minHeight = '480px'
    this.container.style.width = this.options.width
    this.container.style.height = this.options.height

    let widthPx = this.container.clientWidth
    let heightPx = this.container.clientHeight

    if (widthPx === 0 || heightPx === 0) {
      widthPx = 600
      heightPx = 600
    }

    // Initialize Three.js
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      this.renderer.setPixelRatio(window.devicePixelRatio)
      this.renderer.setSize(widthPx, heightPx)
      this.renderer.setClearColor(0x000000, this.options.transparent ? 0 : 1)
      this.container.appendChild(this.renderer.domElement)
    } catch (err) {
      this.showFallback('WebGL unavailable - try another browser')
      return
    }

    // Scene setup
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, widthPx / heightPx, 0.1, 1000)
    this.camera.position.set(0, 0, 3.2)

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6)
    this.scene.add(hemi)
    const point = new THREE.PointLight(this.options.dotColor, 0.8)
    point.position.set(5, 5, 5)
    this.scene.add(point)

    // Create globe
    this.createGlobe()
    
    // Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.enableDamping = true
    this.controls.rotateSpeed = 0.4

    // Load world data and create points
    this.loadWorldData()

    // Mouse interaction
    this.setupMouseInteraction()

    // Start animation
    this.animate()

    // Handle resize
    window.addEventListener('resize', () => this.onResize())
  }

  createGlobe() {
    const R = 1

    // Ocean sphere
    const sphereGeo = new THREE.SphereGeometry(R, 64, 64)
    const sphereMat = new THREE.MeshPhongMaterial({
      color: this.options.oceanColor,
      shininess: 12,
      specular: 0x222222,
      transparent: false,
    })
    this.globeMesh = new THREE.Mesh(sphereGeo, sphereMat)
    this.scene.add(this.globeMesh)

    // Glow shell
    const glowGeo = new THREE.SphereGeometry(R * 1.03, 64, 64)
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.options.glowColor,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    })
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat)
    this.scene.add(this.glowMesh)
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, '#88ff88')
    grad.addColorStop(0.4, '#44ff44')
    grad.addColorStop(1, 'rgba(0,255,136,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(canvas)
  }

  loadWorldData() {
    const localTopo = '/world-110m.json'
    const remoteTopo = 'https://unpkg.com/world-atlas@1/world/110m.json'

    fetch(localTopo)
      .then(r => r.ok ? r.json() : fetch(remoteTopo).then(r => r.json()))
      .then(topo => {
        const countries = topojson.feature(topo, topo.objects.countries)
        this.createBoundaryPoints(countries.features)
        this.createDataFlowRays()
      })
      .catch(err => {
        console.error('Failed to load world data:', err)
        this.showFallback('Failed to load map data')
      })
  }

  createBoundaryPoints(features) {
    const boundaryPositions = []
    const R = 1

    features.forEach(f => {
      const geom = f.geometry
      const processCoords = (coords) => {
        coords.forEach(pair => {
          const lon = pair[0]
          const lat = pair[1]
          const v = this.latLonToVector3(lon, lat, R + 0.002)
          boundaryPositions.push(v.x, v.y, v.z)
        })
      }

      if (geom.type === 'Polygon') {
        processCoords(geom.coordinates[0])
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => processCoords(poly[0]))
      }
    })

    if (boundaryPositions.length) {
      const boundAttr = new Float32Array(boundaryPositions)
      const boundGeo = new THREE.BufferGeometry()
      boundGeo.setAttribute('position', new THREE.BufferAttribute(boundAttr, 3))
      
      const glowTexture = this.createGlowTexture()
      const boundMat = new THREE.PointsMaterial({
        color: this.options.dotColor,
        map: glowTexture,
        size: this.options.dotSize * 0.008,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      
      this.points = new THREE.Points(boundGeo, boundMat)
      this.scene.add(this.points)
    }
  }

  createDataFlowRays() {
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
      { from: [-3.7, 40.4], to: [151.2, -33.9] }, // Madrid to Sydney
      { from: [100.5, 13.7], to: [-0.1, 51.5] }, // Bangkok to London
      { from: [-47.9, -15.8], to: [121.5, 31.2] }, // Brasilia to Shanghai
      { from: [18.4, 59.3], to: [-118.2, 34.1] }, // Stockholm to LA
      { from: [28.0, -26.2], to: [114.1, 22.3] }, // Johannesburg to Hong Kong
      { from: [149.1, -35.3], to: [4.9, 52.4] }, // Canberra to Amsterdam
      { from: [139.7, 35.7], to: [-73.9, 40.7] }, // Tokyo to NYC
      { from: [-79.4, 43.7], to: [77.2, 28.6] }, // Toronto to Delhi
      { from: [55.3, 25.3], to: [2.3, 48.9] }, // Dubai to Paris
      { from: [-157.8, 21.3], to: [151.2, -33.9] }, // Honolulu to Sydney
    ]

    const R = 1
    connections.forEach((connection, index) => {
      const startPos = this.latLonToVector3(connection.from[0], connection.from[1], R + 0.01)
      const endPos = this.latLonToVector3(connection.to[0], connection.to[1], R + 0.01)
      
      const distance = startPos.distanceTo(endPos)
      const arcHeight = Math.max(0.3, distance * 0.4)
      
      const midPoint = new THREE.Vector3()
      midPoint.addVectors(startPos, endPos).multiplyScalar(0.5)
      midPoint.normalize().multiplyScalar(R + arcHeight)
      
      const curve = new THREE.QuadraticBezierCurve3(startPos, midPoint, endPos)
      const points = curve.getPoints(60)
      
      const rayGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const rayMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        linewidth: 4,
      })
      
      const rayLine = new THREE.Line(rayGeometry, rayMaterial)
      rayLine.userData = {
        startTime: index * 0.3,
        duration: 2.5,
        delay: 2,
        points: points,
        originalGeometry: rayGeometry.clone(),
      }
      
      this.dataFlowRays.push(rayLine)
      this.scene.add(rayLine)
    })
  }

  setupMouseInteraction() {
    this.targetX = 0
    this.targetY = 0
    this.currentX = 0
    this.currentY = 0

    this.container.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
      this.targetY = x * 0.5
      this.targetX = y * 0.25
    })
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate())

    // Smooth interpolation
    this.currentX += (this.targetX - this.currentX) * 0.07
    this.currentY += (this.targetY - this.currentY) * 0.07

    // Rotate globe
    if (this.globeMesh) {
      this.globeMesh.rotation.x = this.currentX
      this.globeMesh.rotation.y += this.options.autoRotate ? 0.002 : 0
    }
    if (this.glowMesh) {
      this.glowMesh.rotation.x = this.currentX
      this.glowMesh.rotation.y += this.options.autoRotate ? 0.002 : 0
    }

    // Animate boundary points
    if (this.points) {
      this.points.rotation.x = this.currentX
      this.points.rotation.y += this.options.autoRotate ? 0.002 : 0
      
      const pulse = (Math.sin(this.clock.getElapsedTime() * 2) + 1) * 0.5
      this.points.material.opacity = 0.6 + pulse * 0.4
      this.points.material.size = this.options.dotSize * 0.008 * (0.8 + pulse * 0.4)
    }

    // Animate data flow rays
    const currentTime = this.clock.getElapsedTime()
    this.dataFlowRays.forEach((ray) => {
      const cycleTime = ray.userData.duration + ray.userData.delay
      const elapsed = (currentTime - ray.userData.startTime) % cycleTime
      
      if (elapsed < ray.userData.duration) {
        const progress = elapsed / ray.userData.duration
        const totalPoints = ray.userData.points.length
        const visiblePoints = Math.floor(progress * totalPoints)
        
        if (visiblePoints > 1) {
          const visibleGeometry = new THREE.BufferGeometry().setFromPoints(
            ray.userData.points.slice(0, visiblePoints)
          )
          ray.geometry.dispose()
          ray.geometry = visibleGeometry
          
          let alpha = 1
          if (progress < 0.1) alpha = progress / 0.1
          else if (progress > 0.8) alpha = (1 - progress) / 0.2
          
          ray.material.opacity = alpha * 0.9
        } else {
          ray.material.opacity = 0
        }
      } else {
        ray.material.opacity = 0
        ray.geometry.dispose()
        ray.geometry = ray.userData.originalGeometry.clone()
      }
      
      ray.rotation.x = this.currentX
      ray.rotation.y += this.options.autoRotate ? 0.002 : 0
    })

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  onResize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  showFallback(message) {
    const overlay = document.createElement('div')
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
    `
    overlay.textContent = message
    this.container.appendChild(overlay)
  }

  destroy() {
    if (this.animId) {
      cancelAnimationFrame(this.animId)
    }
    
    if (this.controls) {
      this.controls.dispose()
    }
    
    if (this.renderer) {
      this.renderer.dispose()
    }

    this.dataFlowRays.forEach(ray => {
      this.scene.remove(ray)
      ray.geometry.dispose()
      ray.material.dispose()
      if (ray.userData.originalGeometry) ray.userData.originalGeometry.dispose()
    })

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
    }

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Globe
} else {
  window.Globe = Globe
}