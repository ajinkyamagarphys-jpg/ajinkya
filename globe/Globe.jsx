import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { feature } from 'topojson-client'
import './Globe.css'

function latLonToVector3(lon, lat, radius) {
  const latRad = (lat * Math.PI) / 180
  const lonRad = (-lon * Math.PI) / 180  // negative lon to fix mirroring
  const x = radius * Math.cos(latRad) * Math.cos(lonRad)
  const y = radius * Math.sin(latRad)
  const z = radius * Math.cos(latRad) * Math.sin(lonRad)
  return new THREE.Vector3(x, y, z)
}

export default function Globe({
  width = '100%',
  height = '100vh',
  oceanColor = '#001a1a',
  dotColor = '#00ff88',
  glowColor = '#00ff88',
  transparent = true,
  dotSize = 2.0,
  autoRotate = true,
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    let renderer, scene, camera, globeMesh, glowMesh, points, controls
    let animId
    const container = containerRef.current
    if (!container) return

    const debugMode = typeof window !== 'undefined' && window.location && window.location.search && window.location.search.includes('debug=globe')
    if (debugMode) {
      // make container visible and add logs for debugging
      container.style.outline = '2px dashed rgba(15,157,88,0.6)'
      console.info('[Globe] debug mode enabled')
    }

    let widthPx = container.clientWidth
    let heightPx = container.clientHeight

    // If container has no size yet, ensure a visible fallback size so renderer has dimensions
    if (widthPx === 0 || heightPx === 0) {
      container.style.minHeight = container.style.minHeight || '480px'
      widthPx = container.clientWidth || 600
      heightPx = container.clientHeight || 600
    }

    // renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(widthPx, heightPx)
      renderer.setClearColor(0x000000, transparent ? 0 : 1)
      container.appendChild(renderer.domElement)
    } catch (err) {
      // WebGL not available — show fallback overlay and bail out
      const overlay = document.createElement('div')
      overlay.className = 'globe-fallback'
      overlay.textContent = 'WebGL unavailable or blocked — try another browser or enable hardware acceleration.'
      container.appendChild(overlay)
      console.error('[Globe] WebGL renderer creation failed', err)
      return () => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
      }
    }

    // scene + camera
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(45, widthPx / heightPx, 0.1, 1000)
    camera.position.set(0, 0, 3.2)

    // lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6)
    scene.add(hemi)
    const point = new THREE.PointLight(dotColor, 0.8)
    point.position.set(5, 5, 5)
    scene.add(point)

    // ocean sphere
    const R = 1
    const sphereGeo = new THREE.SphereGeometry(R, 64, 64)
    const sphereMat = new THREE.MeshPhongMaterial({
      color: oceanColor,
      shininess: 12,
      specular: 0x222222,
      transparent: false,
    })
    globeMesh = new THREE.Mesh(sphereGeo, sphereMat)
    scene.add(globeMesh)

    // glow shell (slightly larger)
    const glowGeo = new THREE.SphereGeometry(R * 1.03, 64, 64)
    const glowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    })
    glowMesh = new THREE.Mesh(glowGeo, glowMat)
    scene.add(glowMesh)

    // controls (disabled zoom/pan to keep lightweight)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableDamping = true
    controls.rotateSpeed = 0.4

    // Points for continent boundaries only
    const boundaryPositions = []
    let dataFlowRays = []

    // fetch topojson and convert to geojson — try local copy first, fall back to remote
    const localTopo = '/world-110m.json'
    const remoteTopo = 'https://unpkg.com/world-atlas@1/world/110m.json'

    fetch(localTopo)
      .then((r) => {
        if (!r.ok) throw new Error('local not found')
        return r.json()
      })
      .catch(() => fetch(remoteTopo).then((r) => r.json()))
      .then((topo) => {
        if (debugMode) console.info('[Globe] topojson loaded', topo)
        const countries = feature(topo, topo.objects.countries)
        const features = countries.features

        function pushBoundaryCoords(coords) {
          for (let i = 0; i < coords.length; i += 1) { // all boundary points
            const pair = coords[i]
            const lon = pair[0]
            const lat = pair[1]
            const v = latLonToVector3(lon, lat, R + 0.002)
            boundaryPositions.push(v.x, v.y, v.z)
          }
        }

        // Process only continent boundaries
        features.forEach((f) => {
          const geom = f.geometry
          if (geom.type === 'Polygon') {
            pushBoundaryCoords(geom.coordinates[0])
          } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach((poly) => {
              pushBoundaryCoords(poly[0])
            })
          }
        })

        // Create glowing sprite texture
        function createGlowTexture() {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 32
          const ctx = canvas.getContext('2d')
          const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
          grad.addColorStop(0, '#88ff88')
          grad.addColorStop(0.4, '#44ff44')
          grad.addColorStop(1, 'rgba(0,255,136,0)')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, 32, 32)
          const tex = new THREE.CanvasTexture(canvas)
          return tex
        }

        // Create animated data flow rays with parabolic paths
        function createDataFlowRays() {
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
          
          connections.forEach((connection, index) => {
            const startPos = latLonToVector3(connection.from[0], connection.from[1], R + 0.01)
            const endPos = latLonToVector3(connection.to[0], connection.to[1], R + 0.01)
            
            // Create parabolic arc above the globe
            const distance = startPos.distanceTo(endPos)
            const arcHeight = Math.max(0.3, distance * 0.4) // higher arc for longer distances
            
            const midPoint = new THREE.Vector3()
            midPoint.addVectors(startPos, endPos).multiplyScalar(0.5)
            midPoint.normalize().multiplyScalar(R + arcHeight)
            
            // Create smooth curve
            const curve = new THREE.QuadraticBezierCurve3(startPos, midPoint, endPos)
            const points = curve.getPoints(60)
            
            // Create geometry for the ray
            const rayGeometry = new THREE.BufferGeometry().setFromPoints(points)
            
            // Create animated material with white color
            const rayMaterial = new THREE.LineBasicMaterial({
              color: 0xffffff, // white color
              transparent: true,
              opacity: 0,
              linewidth: 4, // increased line width
            })
            
            const rayLine = new THREE.Line(rayGeometry, rayMaterial)
            
            // Store animation data
            rayLine.userData = {
              startTime: index * 0.3, // faster staggering for more rays
              duration: 2.5,
              delay: 2, // shorter pause between cycles
              points: points,
              originalGeometry: rayGeometry.clone(),
            }
            
            dataFlowRays.push(rayLine)
            scene.add(rayLine)
          })
        }

        // Boundary points with pulsing animation
        if (boundaryPositions.length) {
          const boundAttr = new Float32Array(boundaryPositions)
          const boundGeo = new THREE.BufferGeometry()
          boundGeo.setAttribute('position', new THREE.BufferAttribute(boundAttr, 3))
          const glowTexture = createGlowTexture()
          const boundMat = new THREE.PointsMaterial({
            color: dotColor,
            map: glowTexture,
            size: dotSize * 0.008,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
          points = new THREE.Points(boundGeo, boundMat)
          scene.add(points)

          // Create data flow rays between countries
          createDataFlowRays()
        }



        if (debugMode) console.info('[Globe] points created, count=', boundaryPositions.length / 3)
      })
      .catch((err) => {
        console.error('Failed to load topojson', err)
        const overlay = document.createElement('div')
        overlay.className = 'globe-fallback'
        overlay.textContent = 'Failed to load map data. Check network or try again.'
        container.appendChild(overlay)
      })

    // mouse interaction — rotate toward cursor
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    function onMouseMove(e) {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
      targetY = x * 0.5
      targetX = y * 0.25
    }

    container.addEventListener('mousemove', onMouseMove)
    if (debugMode) console.info('[Globe] mouse handler attached')

    // animation loop
    const clock = new THREE.Clock()
    function animate() {
      animId = requestAnimationFrame(animate)
      const dt = clock.getDelta()

      // smooth interpolate
      currentX += (targetX - currentX) * 0.07
      currentY += (targetY - currentY) * 0.07

      if (globeMesh) {
        globeMesh.rotation.x = currentX
        globeMesh.rotation.y += autoRotate ? 0.002 : 0
      }
      if (glowMesh) {
        glowMesh.rotation.x = currentX
        glowMesh.rotation.y += autoRotate ? 0.002 : 0
      }
      if (points) {
        points.rotation.x = currentX
        points.rotation.y += autoRotate ? 0.002 : 0
        // pulsing animation
        const pulse = (Math.sin(clock.getElapsedTime() * 2) + 1) * 0.5
        points.material.opacity = 0.6 + pulse * 0.4
        points.material.size = dotSize * 0.008 * (0.8 + pulse * 0.4)
      }

      // Animate data flow rays
      const currentTime = clock.getElapsedTime()
      dataFlowRays.forEach((ray) => {
        const cycleTime = ray.userData.duration + ray.userData.delay
        const elapsed = (currentTime - ray.userData.startTime) % cycleTime
        
        if (elapsed < ray.userData.duration) {
          // Ray is active - show progressive drawing
          const progress = elapsed / ray.userData.duration
          const totalPoints = ray.userData.points.length
          const visiblePoints = Math.floor(progress * totalPoints)
          
          if (visiblePoints > 1) {
            const visibleGeometry = new THREE.BufferGeometry().setFromPoints(
              ray.userData.points.slice(0, visiblePoints)
            )
            ray.geometry.dispose()
            ray.geometry = visibleGeometry
            
            // Fade in and out
            let alpha = 1
            if (progress < 0.1) alpha = progress / 0.1
            else if (progress > 0.8) alpha = (1 - progress) / 0.2
            
            ray.material.opacity = alpha * 0.9 // increased opacity
          } else {
            ray.material.opacity = 0
          }
        } else {
          // Ray is in delay phase
          ray.material.opacity = 0
          ray.geometry.dispose()
          ray.geometry = ray.userData.originalGeometry.clone()
        }
        
        // Apply globe rotation to rays
        ray.rotation.x = currentX
        ray.rotation.y += autoRotate ? 0.002 : 0
      })

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // handle resize
    function onResize() {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // cleanup
    return () => {
      cancelAnimationFrame(animId)
      container.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      
      // Clean up data flow rays
      dataFlowRays.forEach(ray => {
        scene.remove(ray)
        ray.geometry.dispose()
        ray.material.dispose()
        if (ray.userData.originalGeometry) ray.userData.originalGeometry.dispose()
      })
      
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      if (debugMode) console.info('[Globe] cleaned up')
    }
  }, [oceanColor, dotColor, glowColor, transparent, dotSize, autoRotate])

  return (
    <div className="globe-wrapper" style={{ width, height }} ref={containerRef}></div>
  )
}
