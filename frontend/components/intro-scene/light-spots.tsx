"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

import { BALL, CEILING, ROOM_RADIUS, SPIN, houseLights } from "./timeline";

const COUNT = 320;
const Z = new Vector3(0, 0, 1);

// Soft-edged squares: a mirror tile's reflection is a blurred copy of the tile.
const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv * 2.0 - 1.0;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vec2 d = abs(vUv);
    float box = 1.0 - smoothstep(0.55, 1.0, max(d.x, d.y));
    float disc = 1.0 - smoothstep(0.2, 1.0, length(vUv));
    gl_FragColor = vec4(vColor * box * disc, 1.0);
  }
`;

interface Spot {
  dir: Vector3;
  color: Color;
  size: number;
  rate: number;
  phase: number;
}

const PALETTE = ["#fff3dc", "#fff3dc", "#ffd27a", "#cfe0ff"].map((c) => new Color(c));

// Where a ray from the ball first meets the room: curtain wall, floor or ceiling.
function hit(dir: Vector3, point: Vector3, normal: Vector3) {
  const h = Math.hypot(dir.x, dir.z);
  const toWall = h > 1e-4 ? ROOM_RADIUS / h : Infinity;
  const toFloor = dir.y < 0 ? -BALL.y / dir.y : Infinity;
  const toCeiling = dir.y > 0 ? (CEILING - BALL.y) / dir.y : Infinity;
  const t = Math.min(toWall, toFloor, toCeiling);
  point.copy(dir).multiplyScalar(t).add(BALL);
  if (t === toFloor) normal.set(0, 1, 0);
  else if (t === toCeiling) normal.set(0, -1, 0);
  else normal.set(-point.x, 0, -point.z).normalize();
  point.addScaledVector(normal, 0.03);
  return t;
}

interface LightSpotsProps {
  random: () => number;
  now: () => number;
}

/** The spots a turning mirror ball throws across the curtains, floor and ceiling. */
export function LightSpots({ random, now }: LightSpotsProps) {
  const mesh = useRef<InstancedMesh>(null);
  const spots = useMemo<Spot[]>(
    () =>
      Array.from({ length: COUNT }, () => {
        const y = -0.92 + random() * 1.3;
        const a = random() * Math.PI * 2;
        const r = Math.sqrt(1 - y * y);
        return {
          dir: new Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
          color: PALETTE[Math.floor(random() * PALETTE.length)],
          size: 0.6 + random() * 0.8,
          rate: 1.5 + random() * 4,
          phase: random() * Math.PI * 2,
        };
      }),
    [random],
  );
  const tmp = useMemo(
    () => ({ dir: new Vector3(), p: new Vector3(), n: new Vector3(), q: new Quaternion(), s: new Vector3(), m: new Matrix4(), c: new Color() }),
    [],
  );

  // instanceColor must exist before the first compile, or the shader never declares it.
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < COUNT; i++) m.setColorAt(i, BLACK);
  }, []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const t = now();
    const angle = t * SPIN;
    const lights = houseLights(t);
    spots.forEach((spot, i) => {
      tmp.dir.copy(spot.dir).applyAxisAngle(Y, angle);
      const dist = hit(tmp.dir, tmp.p, tmp.n);
      tmp.q.setFromUnitVectors(Z, tmp.n);
      tmp.s.setScalar(dist * 0.022 * spot.size);
      m.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
      const twinkle = 0.55 + 0.45 * Math.sin(t * spot.rate + spot.phase);
      m.setColorAt(i, tmp.c.copy(spot.color).multiplyScalar(1.6 * twinkle * lights));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

const Y = new Vector3(0, 1, 0);
const BLACK = new Color(0, 0, 0);
