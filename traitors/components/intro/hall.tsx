"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BoxGeometry,
  type BufferGeometry,
  DoubleSide,
  ExtrudeGeometry,
  type InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { type Stone, type Surfaces, tartan, tiled } from "./textures";
import { HALL } from "./timeline";

// A long vaulted hall in rubble stone: piers and ribs every few metres, two
// tartan banners, and at the far end a pointed arch with the fire beyond it.
// The camera stands near the back wall, looking down -z.

const { halfWidth: HW, spring: SPRING, door: DOOR, back: BACK } = HALL;
const LENGTH = BACK - DOOR;
/** The stone photographs' real size, in metres, so every surface tiles at true scale. */
const WALL_TILE = 2.5;
const FLOOR_TILE = 1.8;
const PIERS = [-1.2, -4.6, -8, -11.4, -14.8];
const DOOR_HALF = 1.15;
const DOOR_RISE = 3.9;

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("hall geometry failed to merge");
  return merged;
}

/** UVs from world position, face by face, so a box's stone isn't stretched. */
function boxUv(g: BufferGeometry, tile: number) {
  const pos = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    if (ax > 0.5) uv.setXY(i, z / tile, y / tile);
    else if (ay > 0.5) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  return g;
}

/** A pier on each wall and the rib that springs between them over the vault. */
function bay() {
  const piers = [-1, 1].map((side) => {
    const p = new BoxGeometry(0.3, SPRING, 0.55);
    p.translate(side * (HW - 0.1), SPRING / 2, 0);
    return boxUv(p, WALL_TILE);
  });
  const rib = new TorusGeometry(HW - 0.12, 0.13, 10, 40, Math.PI);
  rib.translate(0, SPRING, 0);
  return merge([...piers, rib]);
}

/** A pointed (two-centred) arch, as a path from the left foot round to the right. */
function pointed<T extends Path>(path: T, half: number, springAt: number): T {
  const r = half * 1.6;
  const left = -half;
  path.moveTo(left, 0);
  path.lineTo(left, springAt);
  // Each side is an arc centred on the opposite side's springing line.
  path.absarc(left + r, springAt, r, Math.PI, Math.PI - Math.acos(1 - half / r), true);
  path.absarc(half - r, springAt, r, Math.acos(1 - half / r), 0, true);
  path.lineTo(half, 0);
  return path;
}

function doorWall() {
  const top = SPRING + HW;
  const s = new Shape();
  s.moveTo(-HW - 0.1, 0);
  s.lineTo(HW + 0.1, 0);
  s.lineTo(HW + 0.1, top);
  s.lineTo(-HW - 0.1, top);
  s.closePath();
  s.holes.push(pointed(new Path(), DOOR_HALF, DOOR_RISE - 1.3));
  const g = new ShapeGeometry(s, 24);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / WALL_TILE, uv.getY(i) / WALL_TILE);
  return g;
}

/** The thickness of the door's arch: its reveal catches the fire behind. */
function doorReveal() {
  const outer = pointed(new Shape(), DOOR_HALF + 0.35, DOOR_RISE - 1.3);
  outer.holes.push(pointed(new Path(), DOOR_HALF, DOOR_RISE - 1.3));
  const g = new ExtrudeGeometry(outer, { depth: 0.9, bevelEnabled: false, curveSegments: 24 });
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / WALL_TILE, uv.getY(i) / WALL_TILE);
  return g;
}

function stone(s: Stone, color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) {
  return new MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    ...(s.arm && { aoMap: s.arm, roughnessMap: s.arm }),
    color,
    roughness: 1,
    metalness: 0,
    ...extra,
  });
}

function useMaterials(surfaces: Surfaces) {
  return useMemo(() => {
    const { wall, floor } = surfaces;
    return {
      floor: stone(tiled(floor, (2 * HW) / FLOOR_TILE, LENGTH / FLOOR_TILE), "#9c968c", { roughness: 0.8 }),
      wall: stone(tiled(wall, LENGTH / WALL_TILE, SPRING / WALL_TILE), "#66635c"),
      vault: stone(tiled(wall, LENGTH / WALL_TILE, (Math.PI * HW) / WALL_TILE), "#4c443b", { side: BackSide }),
      pier: stone(tiled(wall, 1, 1), "#77736a"),
      end: stone(tiled(wall, 1, 1), "#6f6559"),
      back: stone(tiled(wall, (2 * HW) / WALL_TILE, SPRING / WALL_TILE), "#4c443b"),
      banner: new MeshStandardMaterial({ map: tartan(), color: "#b8b0a0", roughness: 0.92, side: DoubleSide }),
    };
  }, [surfaces]);
}

function Bays({ material }: { material: MeshStandardMaterial }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => bay(), []);
  useLayoutEffect(() => {
    const o = new Object3D();
    PIERS.forEach((z, i) => {
      o.position.set(0, 0, z);
      o.updateMatrix();
      mesh.current?.setMatrixAt(i, o.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[geometry, material, PIERS.length]} receiveShadow />;
}

// A long banner hung flat to the wall, with a little sag along its foot.
function banner() {
  const g = new PlaneGeometry(1, 2.6, 8, 16);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, 0.03 * Math.sin(x * 9 + y * 1.5) * (1.3 - y / 2.6));
    if (y < -1.25) pos.setY(i, y - 0.18 * (1 - Math.abs(x) * 2));
  }
  g.computeVertexNormals();
  return g;
}

interface HallProps {
  surfaces: Surfaces;
}

/** The stonework: floor, walls, vault, piers, the door's wall and the banners. */
export function Hall({ surfaces }: HallProps) {
  const m = useMaterials(surfaces);
  const door = useMemo(() => doorWall(), []);
  const reveal = useMemo(() => doorReveal(), []);
  const flag = useMemo(() => banner(), []);
  const mid = (BACK + DOOR) / 2;

  return (
    <group>
      <mesh material={m.floor} position={[0, 0, mid]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2 * HW, LENGTH]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={m.wall} position={[side * HW, SPRING / 2, mid]} rotation={[0, -side * (Math.PI / 2), 0]} receiveShadow>
          <planeGeometry args={[LENGTH, SPRING]} />
        </mesh>
      ))}
      <mesh material={m.vault} position={[0, SPRING, mid]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[HW, HW, LENGTH, 32, 1, true, -Math.PI / 2, Math.PI]} />
      </mesh>
      <Bays material={m.pier} />
      <mesh geometry={door} material={m.end} position={[0, 0, DOOR]} receiveShadow />
      <mesh geometry={reveal} material={m.pier} position={[0, 0, DOOR - 0.9]} />
      <mesh material={m.back} position={[0, SPRING / 2 + 1, BACK]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2 * HW, SPRING + 2]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={flag}
          material={m.banner}
          position={[side * (HW - 0.06), 2.75, -6.8]}
          rotation={[0, -side * (Math.PI / 2), 0]}
          receiveShadow
        />
      ))}
    </group>
  );
}
