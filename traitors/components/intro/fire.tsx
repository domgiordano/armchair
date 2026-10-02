"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  type DataTexture,
  InstancedBufferGeometry,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  MeshStandardMaterial,
  Object3D,
  type PointLight,
  type SpotLight,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { beyondMaterial, emberBases, emberMaterial, flameMaterial, fogMaterial, quad, seeds } from "./billboard";
import { doorGlow, FIRE, FLAME, HALL, type Light, light, shot, TORCHES } from "./timeline";

interface Clocked {
  now: () => number;
}

// Shared by every flame, fog sheet and ember; written once a frame.
const clock = { value: 0 };
const glow = { value: 1 };

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("fire geometry failed to merge");
  return merged;
}

// A wall torch for a wall at -x, with the top of its cup at the origin: an
// iron bracket, a pitch-wrapped head in a cage.
function torch() {
  const stick = new CylinderGeometry(0.028, 0.034, 0.6, 10);
  stick.rotateZ(-0.38);
  stick.translate(-0.11, -0.36, 0);
  const cup = new CylinderGeometry(0.085, 0.05, 0.16, 12, 1, true);
  cup.translate(0, -0.08, 0);
  const ring = new CylinderGeometry(0.09, 0.09, 0.02, 12);
  ring.translate(0, -0.005, 0);
  const plate = new BoxGeometry(0.03, 0.34, 0.14);
  plate.translate(-0.22, -0.64, 0);
  return merge([stick, cup, ring, plate]);
}

const iron = new MeshStandardMaterial({ color: "#16130f", roughness: 0.5, metalness: 0.8 });

function Torches() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => torch(), []);
  useLayoutEffect(() => {
    const o = new Object3D();
    TORCHES.forEach((at, i) => {
      o.position.copy(at);
      o.rotation.set(0, at.x < 0 ? 0 : Math.PI, 0);
      o.updateMatrix();
      mesh.current?.setMatrixAt(i, o.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[geometry, iron, TORCHES.length]} castShadow />;
}

/** Every torch's flame, one draw call. */
function Flames() {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = quad(0.5);
    g.setAttribute("aSeed", seeds(TORCHES.length));
    return g;
  }, []);
  const material = useMemo(() => flameMaterial({ uTime: clock }), []);
  useLayoutEffect(() => {
    const m = new Matrix4();
    TORCHES.forEach((at, i) => mesh.current?.setMatrixAt(i, m.makeScale(0.34, 0.72, 1).setPosition(at.x, at.y - 0.06, at.z)));
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[geometry, material, TORCHES.length]} frustumCulled={false} renderOrder={3} />;
}

// Fog sheets across the hall, front to back: none nearer than the lead stands
// in the second shot, so nothing veils the hood in the close-up.
const SHEETS = [-1.7, -2.6, -3.6, -4.7, -5.9, -7.2, -8.6, -10.1, -11.7, -13.3, -14.9];

function Fog({ low, noise }: { low: boolean; noise: DataTexture }) {
  const mesh = useRef<InstancedMesh>(null);
  const sheets = useMemo(() => (low ? SHEETS.filter((_, i) => i % 2 === 0) : SHEETS), [low]);
  const geometry = useMemo(() => {
    const g = quad(0.5);
    g.setAttribute("aSeed", seeds(sheets.length));
    return g;
  }, [sheets]);
  const material = useMemo(
    () =>
      fogMaterial({
        uTime: clock,
        uGlow: glow,
        uTorch: { value: 0.55 },
        uDensity: { value: low ? 0.5 : 0.28 },
        uNoise: { value: noise },
      }),
    [low, noise],
  );
  useLayoutEffect(() => {
    const m = new Matrix4();
    sheets.forEach((z, i) => mesh.current?.setMatrixAt(i, m.makeScale(2 * HALL.halfWidth + 0.2, 6.2, 1).setPosition(0, -0.05, z)));
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [sheets]);
  return <instancedMesh key={sheets.length} ref={mesh} args={[geometry, material, sheets.length]} frustumCulled={false} renderOrder={2} />;
}

function Embers({ low }: { low: boolean }) {
  const geometry = useMemo(() => {
    const q = quad();
    const g = new InstancedBufferGeometry();
    g.setIndex(q.getIndex());
    g.setAttribute("position", q.getAttribute("position"));
    g.setAttribute("uv", q.getAttribute("uv"));
    const per = low ? 10 : 22;
    const torches = TORCHES.map((v) => new Vector3(v.x * 0.92, v.y + 0.25, v.z));
    const bases = emberBases(
      [...torches, new Vector3(0, 0.6, HALL.door + 0.6), new Vector3(0, 0.4, -4.5), new Vector3(0, 0.4, -1.4)],
      per,
      [0.5, 0.4, 1.4],
    );
    g.setAttribute("aBase", bases);
    g.setAttribute("aSeed", seeds(bases.count));
    g.instanceCount = bases.count;
    return g;
  }, [low]);
  const material = useMemo(() => emberMaterial({ uTime: clock }), []);
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={4} />;
}

interface BeyondProps extends Clocked {
  sun: RefObject<Mesh | null>;
}

/** The fire beyond the door: the scene's brightest thing, and the source of its light shafts. */
function Beyond({ sun }: BeyondProps) {
  const material = useMemo(() => beyondMaterial({ uTime: clock, uGlow: glow }), []);
  return (
    <mesh ref={sun} material={material} position={[0, 3, FIRE.z]}>
      <planeGeometry args={[9, 7]} />
    </mesh>
  );
}

/** Three flickering point lights, and the door's spot that throws the procession's shadows down the hall. */
function Lights({ now, low }: Clocked & { low: boolean }) {
  const points = useRef<(PointLight | null)[]>([]);
  const spot = useRef<SpotLight>(null);
  const scratch = useMemo<Light>(() => ({ at: new Vector3(), intensity: 0 }), []);
  useLayoutEffect(() => {
    const s = spot.current;
    if (!s) return;
    s.target.position.set(0, 0, -1);
    s.target.updateMatrixWorld();
  }, []);
  useFrame(() => {
    const t = now();
    clock.value = t;
    glow.value = doorGlow(t);
    points.current.forEach((l, i) => {
      if (!l) return;
      light(i, t, scratch);
      l.position.copy(scratch.at);
      l.intensity = scratch.intensity;
    });
    if (spot.current) spot.current.intensity = (shot(t) === "reveal" ? 500 : 1100) * glow.value;
  });
  return (
    <>
      {[0, 1, 2].map((i) => (
        <pointLight
          key={i}
          ref={(l) => {
            points.current[i] = l;
          }}
          color={FLAME}
          decay={2}
          intensity={0}
        />
      ))}
      <spotLight
        ref={spot}
        color="#ff9a4a"
        position={[0, 2.9, HALL.door - 0.6]}
        angle={0.62}
        penumbra={0.9}
        decay={2}
        castShadow
        shadow-mapSize={low ? [512, 512] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-blurSamples={12}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
      />
    </>
  );
}

interface FireProps extends Clocked {
  low: boolean;
  noise: DataTexture;
  sun: RefObject<Mesh | null>;
}

/** Torches, the door's fire, their light, the fog that carries it, and embers. */
export function Fire({ now, low, noise, sun }: FireProps) {
  return (
    <>
      <Lights now={now} low={low} />
      <Torches />
      <Flames />
      <Beyond now={now} sun={sun} />
      <Fog low={low} noise={noise} />
      <Embers low={low} />
    </>
  );
}
