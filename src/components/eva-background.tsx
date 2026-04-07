"use client"

import { useEffect, useRef } from "react"

export function EvaBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let animationId: number
    let cleanup: (() => void) | null = null

    async function init() {
      if (!container) return
      const el = container

      const THREE = await import("three")

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
      camera.position.set(0, 0, 5)

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setClearColor(0x000000, 0)
      el.appendChild(renderer.domElement)

      // AT Field hexagonal wireframe
      const geometry = new THREE.IcosahedronGeometry(3, 1)
      const wireframe = new THREE.WireframeGeometry(geometry)
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xFF4800,
        transparent: true,
        opacity: 0.08,
      })
      const mesh = new THREE.LineSegments(wireframe, lineMaterial)
      scene.add(mesh)

      // Inner octahedron
      const innerGeo = new THREE.OctahedronGeometry(1.2, 0)
      const innerWire = new THREE.WireframeGeometry(innerGeo)
      const innerMat = new THREE.LineBasicMaterial({
        color: 0x00FFFF,
        transparent: true,
        opacity: 0.06,
      })
      const innerMesh = new THREE.LineSegments(innerWire, innerMat)
      scene.add(innerMesh)

      function animate() {
        animationId = requestAnimationFrame(animate)
        mesh.rotation.x += 0.0008
        mesh.rotation.y += 0.0012
        innerMesh.rotation.x -= 0.001
        innerMesh.rotation.z += 0.0015

        // Subtle opacity pulse
        const t = Date.now() * 0.001
        lineMaterial.opacity = 0.06 + 0.03 * Math.sin(t * 0.5)
        innerMat.opacity = 0.04 + 0.03 * Math.sin(t * 0.7 + 1)

        renderer.render(scene, camera)
      }

      function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }

      window.addEventListener("resize", onResize)
      animate()

      cleanup = () => {
        window.removeEventListener("resize", onResize)
        cancelAnimationFrame(animationId)
        renderer.dispose()
        geometry.dispose()
        lineMaterial.dispose()
        innerGeo.dispose()
        innerMat.dispose()
        if (el.contains(renderer.domElement)) {
          el.removeChild(renderer.domElement)
        }
      }
    }

    init()

    return () => {
      if (cleanup) cleanup()
      else cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}
