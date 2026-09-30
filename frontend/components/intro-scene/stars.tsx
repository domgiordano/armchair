"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, CanvasTexture, Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

// A four-point star: a concave diamond with a soft glow round a hot core. Drawn,
// not photographed, so it reads as a TV sparkle rather than a lens artefact.
function starTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = Math.abs((x / (size - 1)) * 2 - 1);
      const v = Math.abs((y / (size - 1)) * 2 - 1);
      const r = Math.hypot(u, v);
      const star = Math.sqrt(u) + Math.sqrt(v);
      const body = 1 - Math.min(1, Math.max(0, (star - 0.55) / 0.3));
      const glow = 0.45 * Math.exp(-r * r * 9);
      const a = Math.min(1, body + glow) * Math.max(0, 1 - r);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new CanvasTexture(canvas);
}

// Camera-facing quads: the translation of each instance matrix places the star,
// its upper 2x2 spins and sizes it in screen space.
const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vColor = instanceColor;
    vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
    mv.xy += mat2(instanceMatrix[0].xy, instanceMatrix[1].xy) * position.xy;
    gl_Position = projectionMatrix * mv;
  }
`;
const fragment = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor * texture2D(map, vUv).a, 1.0);
  }
`;

export interface Star {
  position: Vector3;
  size: number;
  angle: number;
  /** Additive, so black is off. */
  color: Color;
}

interface StarsProps {
  count: number;
  now: () => number;
  place: (t: number, i: number, star: Star, eye: Vector3) => void;
}

export function Stars({ count, now, place }: StarsProps) {
  const mesh = useRef<InstancedMesh>(null);
  const uniforms = useMemo(() => ({ map: { value: starTexture() } }), []);
  const scratch = useRef<ReturnType<typeof makeScratch>>(null);

  // instanceColor must exist before the first compile, or the shader never declares it.
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < count; i++) m.setColorAt(i, BLACK);
  }, [count]);

  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    const t = now();
    scratch.current ??= makeScratch();
    const { star, q, s, matrix } = scratch.current;
    for (let i = 0; i < count; i++) {
      star.color.setRGB(0, 0, 0);
      star.size = 0;
      star.angle = 0;
      place(t, i, star, camera.position);
      q.setFromAxisAngle(Z, star.angle);
      s.setScalar(star.size);
      m.setMatrixAt(i, matrix.compose(star.position, q, s));
      m.setColorAt(i, star.color);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={3}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

const makeScratch = () => ({
  star: { position: new Vector3(), size: 0, angle: 0, color: new Color() } as Star,
  q: new Quaternion(),
  s: new Vector3(),
  matrix: new Matrix4(),
});

const Z = new Vector3(0, 0, 1);
const BLACK = new Color(0, 0, 0);
