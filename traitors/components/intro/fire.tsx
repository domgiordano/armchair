"use client";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  type InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  type PointLight,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { flameMaterial, quad, seeds, smokeMaterial } from "./billboard";
import { CANDLES, CORRIDOR_TORCHES, FIRE, HALL_TORCHES, light, TABLE_TOP } from "./timeline";

interface Clocked {
  now: () => number;
  low: boolean;
}

// Shared by every flame and smoke quad; written once a frame.
const fire = { uTime: { value: 0 } };
const smoke = { uTime: { value: 0 }, uOpacity: { value: 0.34 } };

/** Where the candelabra holds its candles above the table. */
const STAND = 0.26;

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("fire geometry failed to merge");
  return merged;
}

// A wall torch for a wall at +x, with the top of its cup at the origin.
function torch() {
  const stick = new CylinderGeometry(0.03, 0.035, 0.55, 8);
  stick.rotateZ(0.42);
  stick.translate(0.1, -0.36, 0);
  const cup = new CylinderGeometry(0.085, 0.045, 0.13, 10, 1, true);
  cup.translate(0, -0.065, 0);
  const plate = new BoxGeometry(0.04, 0.3, 0.16);
  plate.translate(0.19, -0.6, 0);
  return merge([stick, cup, plate]);
}

function candelabra() {
  const stem = new CylinderGeometry(0.03, 0.09, STAND, 12);
  stem.translate(0, STAND / 2, 0);
  const bar = new CylinderGeometry(0.018, 0.018, 1.32, 8);
  bar.rotateZ(Math.PI / 2);
  bar.translate(0, STAND - 0.02, 0.0);
  const dishes = [-0.62, -0.32, 0, 0.32, 0.6].map((x) => {
    const d = new CylinderGeometry(0.06, 0.03, 0.03, 12);
    d.translate(x, STAND, 0);
    return d;
  });
  return merge([stem, bar, ...dishes]);
}

interface Flame {
  at: Vector3;
  w: number;
  h: number;
}

const FLAMES: Flame[] = [
  ...[...CORRIDOR_TORCHES, ...HALL_TORCHES].map((at) => ({ at, w: 0.24, h: 0.5 })),
  ...CANDLES.map(([x, z, h], i) => ({
    at: new Vector3(x, TABLE_TOP + h + (i < 5 ? STAND : 0) + 0.005, z),
    w: 0.05,
    h: 0.13,
  })),
];

/** Every flame in both shots, one draw call. */
function Flames() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = quad(0.5);
    g.setAttribute("aSeed", seeds(FLAMES.length));
    return g;
  }, []);
  const material = useMemo(() => flameMaterial(fire), []);

  useLayoutEffect(() => {
    const m = new Matrix4();
    FLAMES.forEach((f, i) => mesh.current?.setMatrixAt(i, m.makeScale(f.w, f.h, 1).setPosition(f.at)));
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);

  return <instancedMesh ref={mesh} args={[geometry, material, FLAMES.length]} frustumCulled={false} renderOrder={2} />;
}

const iron = new MeshStandardMaterial({ color: "#1c1916", roughness: 0.55, metalness: 0.7 });
const gilt = new MeshStandardMaterial({ color: "#c79a3a", roughness: 0.32, metalness: 1, emissive: "#3a2408" });
const wax = new MeshStandardMaterial({ color: "#e6d8b8", roughness: 0.6, emissive: "#4a2a10", emissiveIntensity: 0.6 });

function Torches() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => torch(), []);
  const all = useMemo(() => [...CORRIDOR_TORCHES, ...HALL_TORCHES], []);

  useLayoutEffect(() => {
    const o = new Object3D();
    all.forEach((at, i) => {
      o.position.copy(at);
      // Corridor torches hang on the side walls; the hall's on the wall behind the procession.
      o.rotation.set(0, i >= CORRIDOR_TORCHES.length ? Math.PI / 2 : at.x > 0 ? 0 : Math.PI, 0);
      o.updateMatrix();
      mesh.current?.setMatrixAt(i, o.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [all]);

  return <instancedMesh ref={mesh} args={[geometry, iron, all.length]} />;
}

function Candles() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new CylinderGeometry(0.032, 0.036, 1, 12);
    g.translate(0, 0.5, 0);
    return g;
  }, []);
  const stand = useMemo(() => candelabra(), []);

  useLayoutEffect(() => {
    const m = new Matrix4();
    CANDLES.forEach(([x, z, h], i) =>
      mesh.current?.setMatrixAt(i, m.makeScale(1, h, 1).setPosition(x, TABLE_TOP + (i < 5 ? STAND : 0), z)),
    );
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={mesh} args={[geometry, wax, CANDLES.length]} />
      <mesh geometry={stand} material={gilt} position={[-0.75, TABLE_TOP, 30.6]} rotation={[0, -0.08, 0]} />
    </>
  );
}

/** Four lights at most, each flickering on its own phase, moved to wherever the shot is. */
function Lights({ now }: Pick<Clocked, "now">) {
  const lights = useRef<(PointLight | null)[]>([]);
  useFrame(() => {
    const t = now();
    fire.uTime.value = t;
    smoke.uTime.value = t;
    lights.current.forEach((l, i) => {
      if (l) l.intensity = light(i, t, l.position);
    });
  });
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <pointLight
          key={i}
          ref={(l) => {
            lights.current[i] = l;
          }}
          color={FIRE}
          decay={2}
          intensity={0}
        />
      ))}
    </>
  );
}

const HAZE = [
  // x, y, z, size
  [0.3, 2.9, -4.5, 3.2],
  [-0.4, 3.1, -9, 3.6],
  [0.2, 2.8, -14, 4],
  [-0.2, 0.35, -7, 3],
  [0.5, 0.3, -12, 3.4],
  [-1.6, 3.4, 25.5, 5],
  [2.2, 3.6, 26.5, 5],
  [0, 4.2, 30, 6],
] as const;

function Haze() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = quad();
    g.setAttribute("aSeed", seeds(HAZE.length));
    return g;
  }, []);
  const material = useMemo(() => smokeMaterial(smoke), []);

  useLayoutEffect(() => {
    const m = new Matrix4();
    HAZE.forEach(([x, y, z, s], i) => mesh.current?.setMatrixAt(i, m.makeScale(s, s * 0.6, 1).setPosition(x, y, z)));
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);

  return <instancedMesh ref={mesh} args={[geometry, material, HAZE.length]} frustumCulled={false} renderOrder={1} />;
}

/** Torches, candles, their light, embers and smoke, for both shots. */
export function Fire({ now, low }: Clocked) {
  return (
    <>
      <Lights now={now} />
      <Torches />
      <Candles />
      <Flames />
      {!low && <Haze />}
      <Sparkles
        count={low ? 30 : 70}
        position={[0, 2, -7.5]}
        scale={[2.6, 2.6, 13]}
        size={3}
        speed={0.45}
        noise={1.5}
        color="#f2662a"
        opacity={0.9}
      />
      <Sparkles count={low ? 20 : 45} position={[0, 1.7, 28.5]} scale={[5, 2.2, 4]} size={2.4} speed={0.3} color="#ffd27a" opacity={0.8} />
    </>
  );
}
