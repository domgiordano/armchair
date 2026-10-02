"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  type InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { stone, tartan, wood } from "./textures";
import { TABLE, TABLE_RADIUS, TABLE_TOP } from "./timeline";

// The corridor runs down -z from just behind the camera; the hall is a round
// stone room around the table at TABLE, with its door at the -z wall.

const WIDTH = 3.2;
const SPRING = 3.0;
const CORRIDOR = 32;
const HALL_RADIUS = 7;
const DOOR_Z = TABLE.z - HALL_RADIUS;

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("castle geometry failed to merge");
  return merged;
}

// A rib across the vault and the two pilasters under it.
function arch(radius: number, height: number) {
  const rib = new TorusGeometry(radius, 0.1, 6, 24, Math.PI);
  rib.translate(0, height, 0);
  const posts = [-1, 1].map((side) => {
    const p = new BoxGeometry(0.22, height, 0.3);
    p.translate(side * (radius - 0.04), height / 2, 0);
    return p;
  });
  return merge([rib, ...posts]);
}

function useSurfaces() {
  return useMemo(() => {
    const walls = stone(7, [CORRIDOR / 4, 1.1]);
    const floor = stone(19, [1.2, 10], 4);
    const ribs = stone(23, [0.6, 0.6]);
    const hallWall = stone(31, [12, 1.8]);
    const flags = stone(43, [5, 5], 4);
    const oak = wood(5, [2, 2]);
    const mat = (s: { map: typeof walls.map; bump: typeof walls.bump }, color: string, bumpScale: number) =>
      new MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale, color, roughness: 0.94, metalness: 0 });
    return {
      wall: mat(walls, "#b8aa94", 3),
      vault: new MeshStandardMaterial({ map: walls.map, bumpMap: walls.bump, bumpScale: 3, color: "#8f8371", roughness: 0.95, side: BackSide }),
      floor: mat(floor, "#9a8d7a", 2),
      rib: mat(ribs, "#c9b9a0", 2.5),
      hallWall: new MeshStandardMaterial({ map: hallWall.map, bumpMap: hallWall.bump, bumpScale: 3, color: "#b0a28c", roughness: 0.94, side: BackSide }),
      flags: mat(flags, "#8d806d", 2),
      oak: new MeshStandardMaterial({ map: oak.map, bumpMap: oak.bump, bumpScale: 1, color: "#d9b79a", roughness: 0.55 }),
      cloth: new MeshStandardMaterial({ map: tartan(), color: "#ffffff", roughness: 0.9, side: DoubleSide }),
    };
  }, []);
}

const gilt = new MeshStandardMaterial({ color: "#c79a3a", roughness: 0.3, metalness: 1, emissive: "#2a1a06" });
const dark = new MeshStandardMaterial({ color: "#050403", roughness: 1 });

function Ribs({ material }: { material: MeshStandardMaterial }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => arch(WIDTH / 2, SPRING), []);
  const count = 10;
  useLayoutEffect(() => {
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, -1.9 - i * 3.4);
      o.updateMatrix();
      mesh.current?.setMatrixAt(i, o.matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={mesh} args={[geometry, material, count]} />;
}

type Surfaces = ReturnType<typeof useSurfaces>;

function Corridor({ s }: { s: Surfaces }) {
  const mid = -CORRIDOR / 2 + 1.5;
  return (
    <group>
      <mesh material={s.floor} position={[0, 0, mid]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WIDTH, CORRIDOR]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={s.wall} position={[side * (WIDTH / 2), SPRING / 2, mid]} rotation={[0, -side * (Math.PI / 2), 0]}>
          <planeGeometry args={[CORRIDOR, SPRING]} />
        </mesh>
      ))}
      <mesh material={s.vault} position={[0, SPRING, mid]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WIDTH / 2, WIDTH / 2, CORRIDOR, 24, 1, true, -Math.PI / 2, Math.PI]} />
      </mesh>
      <Ribs material={s.rib} />
      <mesh material={dark} position={[0, 2.4, 1.5]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[WIDTH, 4.8]} />
      </mesh>
    </group>
  );
}

// A swallowtail banner, hung from its top edge, with UVs over its box.
function banner(w: number, h: number) {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, -h);
  s.lineTo(0, -h + 0.32);
  s.lineTo(-w / 2, -h);
  s.closePath();
  const g = new ShapeGeometry(s);
  const uv = g.getAttribute("uv");
  const pos = g.getAttribute("position");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 1);
  return g;
}

function doorway() {
  const s = new Shape();
  s.moveTo(-0.95, 0);
  s.lineTo(-0.95, 2.3);
  s.absarc(0, 2.3, 0.95, Math.PI, 0, true);
  s.lineTo(0.95, 0);
  s.closePath();
  return new ShapeGeometry(s);
}

function Hall({ s }: { s: Surfaces }) {
  const bannerGeometry = useMemo(() => banner(1.05, 2.5), []);
  const door = useMemo(() => doorway(), []);
  const doorArch = useMemo(() => arch(1.02, 2.3), []);
  const chairs = useRef<InstancedMesh>(null);
  const chair = useMemo(() => {
    const seat = new BoxGeometry(0.5, 0.07, 0.48);
    seat.translate(0, 0.48, 0);
    const back = new BoxGeometry(0.5, 1.15, 0.07);
    back.translate(0, 1.0, -0.22);
    const finial = new CylinderGeometry(0.05, 0.05, 0.08, 8);
    finial.translate(0, 1.6, -0.22);
    const legs = [-0.21, 0.21].flatMap((x) =>
      [-0.2, 0.2].map((z) => {
        const l = new BoxGeometry(0.05, 0.48, 0.05);
        l.translate(x, 0.24, z);
        return l;
      }),
    );
    return merge([seat, back, finial, ...legs]);
  }, []);
  // Round the table, leaving room behind it for the procession and in front for the camera.
  const seats = useMemo(() => [1.75, -1.75].map((a) => a + Math.PI), []);

  useLayoutEffect(() => {
    const o = new Object3D();
    seats.forEach((a, i) => {
      o.position.set(TABLE.x + Math.sin(a) * 2.4, 0, TABLE.z + Math.cos(a) * 2.4);
      // Seat towards the table, back to the room.
      o.rotation.set(0, a + Math.PI, 0);
      o.updateMatrix();
      chairs.current?.setMatrixAt(i, o.matrix);
    });
    if (chairs.current) chairs.current.instanceMatrix.needsUpdate = true;
  }, [seats]);

  return (
    <group>
      <mesh material={s.flags} position={[TABLE.x, 0, TABLE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HALL_RADIUS + 0.2, 48]} />
      </mesh>
      <mesh material={s.hallWall} position={[TABLE.x, 3, TABLE.z]}>
        <cylinderGeometry args={[HALL_RADIUS, HALL_RADIUS, 6, 48, 1, true]} />
      </mesh>
      <mesh material={dark} position={[TABLE.x, 6, TABLE.z]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HALL_RADIUS + 0.2, 32]} />
      </mesh>

      <mesh geometry={door} material={dark} position={[0, 0, DOOR_Z + 0.06]} />
      <mesh geometry={doorArch} material={s.rib} position={[0, 0, DOOR_Z + 0.12]} />

      {[-1, 1].map((side) => {
        const x = side * 3.4;
        const z = TABLE.z - Math.sqrt(HALL_RADIUS ** 2 - x * x) + 0.12;
        const yaw = Math.atan2(TABLE.x - x, TABLE.z - z);
        return (
          <group key={side} position={[x, 4.3, z]} rotation={[0, yaw, 0]}>
            <mesh geometry={bannerGeometry} material={s.cloth} />
            <mesh material={gilt} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 1.3, 8]} />
            </mesh>
          </group>
        );
      })}

      <group position={[TABLE.x, 0, TABLE.z]}>
        <mesh material={s.oak} position={[0, TABLE_TOP - 0.045, 0]}>
          <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.09, 72]} />
        </mesh>
        <mesh material={gilt} position={[0, TABLE_TOP - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[TABLE_RADIUS + 0.01, 0.03, 8, 96]} />
        </mesh>
        <mesh material={s.oak} position={[0, (TABLE_TOP - 0.09) / 2, 0]}>
          <cylinderGeometry args={[0.32, 0.6, TABLE_TOP - 0.09, 24]} />
        </mesh>
      </group>
      <instancedMesh ref={chairs} args={[chair, s.oak, seats.length]} />
    </group>
  );
}

/** The stonework, the hall's table and chairs, and its tartan banners. */
export function Castle() {
  const s = useSurfaces();
  return (
    <>
      <Corridor s={s} />
      <Hall s={s} />
    </>
  );
}
