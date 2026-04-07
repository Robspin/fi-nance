"use client"

import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

function ATField() {
  const outerRef = useRef<THREE.LineSegments>(null)
  const innerRef = useRef<THREE.LineSegments>(null)
  const outerMatRef = useRef<THREE.LineBasicMaterial>(null)
  const innerMatRef = useRef<THREE.LineBasicMaterial>(null)

  useFrame(() => {
    if (outerRef.current) {
      outerRef.current.rotation.x += 0.001
      outerRef.current.rotation.y += 0.0015
    }
    if (innerRef.current) {
      innerRef.current.rotation.x -= 0.0012
      innerRef.current.rotation.z += 0.002
    }
    const t = Date.now() * 0.001
    if (outerMatRef.current) {
      outerMatRef.current.opacity = 0.18 + 0.08 * Math.sin(t * 0.5)
    }
    if (innerMatRef.current) {
      innerMatRef.current.opacity = 0.12 + 0.06 * Math.sin(t * 0.7 + 1)
    }
  })

  return (
    <>
      <lineSegments ref={outerRef}>
        <wireframeGeometry args={[new THREE.IcosahedronGeometry(3.5, 1)]} />
        <lineBasicMaterial
          ref={outerMatRef}
          color={0x00FFFF}
          transparent
          opacity={0.2}
        />
      </lineSegments>
      <lineSegments ref={innerRef}>
        <wireframeGeometry args={[new THREE.OctahedronGeometry(1.5, 0)]} />
        <lineBasicMaterial
          ref={innerMatRef}
          color={0xFF4800}
          transparent
          opacity={0.14}
        />
      </lineSegments>
    </>
  )
}

export function EvaBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ alpha: true, antialias: false }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <ATField />
      </Canvas>
    </div>
  )
}
