"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CubeCamera,
  Euler,
  type Group,
  HalfFloatType,
  type InstancedMesh,
  Matrix4,
  type MeshStandardMaterial,
  PMREMGenerator,
  Quaternion,
  type Sprite,
  type Texture,
  Vector3,
  WebGLCubeRenderTarget,
} from "three";

import { BALL, BALL_RADIUS, SPIN } from "./timeline";

const TILE = 0.094;
const GAP = 0.014;
const GLINTS = 7;

interface Tile {
  normal: Vector3;
  matrix: Matrix4;
}

// Rings of square mirrors from pole to pole, each nudged a degree or two off
// true so neighbouring tiles catch different parts of the room.
function tiles(random: () => number): Tile[] {
  const rings = Math.round((Math.PI * BALL_RADIUS) / TILE);
  const out: Tile[] = [];
  const tilt = new Euler();
  const q = new Quaternion();
  const z = new Vector3(0, 0, 1);
  for (let i = 0; i < rings; i++) {
    const lat = -Math.PI / 2 + ((i + 0.5) * Math.PI) / rings;
    const count = Math.max(1, Math.round((2 * Math.PI * BALL_RADIUS * Math.cos(lat)) / TILE));
    const offset = random() * Math.PI;
    for (let j = 0; j < count; j++) {
      const lon = offset + (j * 2 * Math.PI) / count;
      const normal = new Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      q.setFromUnitVectors(z, normal);
      tilt.set((random() - 0.5) * 0.14, (random() - 0.5) * 0.14, 0);
      q.multiply(new Quaternion().setFromEuler(tilt));
      const size = TILE - GAP;
      const matrix = new Matrix4().compose(
        normal.clone().multiplyScalar(BALL_RADIUS),
        q.clone(),
        new Vector3(size, size * Math.min(1, 0.55 + Math.cos(lat)), 1),
      );
      out.push({ normal, matrix });
    }
  }
  return out;
}

// A four-point star with a hot core: the lens flare a mirror tile throws at the lens.
function starTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / (size - 1)) * 2 - 1;
      const v = (y / (size - 1)) * 2 - 1;
      const r = Math.hypot(u, v);
      const core = Math.exp(-r * r * 60) + 0.2 * Math.exp(-r * r * 16);
      const streak = Math.exp(-Math.abs(u) * 34) * Math.exp(-Math.abs(v) * 2.4) + Math.exp(-Math.abs(v) * 34) * Math.exp(-Math.abs(u) * 2.4);
      const a = Math.min(1, core + 0.9 * streak) * Math.max(0, 1 - r) ** 2;
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 250;
      img.data[i + 2] = 240;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new CanvasTexture(canvas);
}

interface MirrorBallProps {
  random: () => number;
  now: () => number;
}

export function MirrorBall({ random, now }: MirrorBallProps) {
  const spin = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const glints = useRef<(Sprite | null)[]>([]);
  const all = useMemo(() => tiles(random), [random]);
  const star = useMemo(() => starTexture(), []);
  const picks = useMemo(() => Array.from({ length: GLINTS }, () => ({ tile: 0, cycle: -1 })), []);
  const world = useMemo(() => ({ n: new Vector3(), p: new Vector3(), toEye: new Vector3() }), []);
  const glass = useRef<MeshStandardMaterial>(null);
  const frames = useRef(0);
  const [cube] = useState(() => new WebGLCubeRenderTarget(256, { type: HalfFloatType }));
  const [room, setRoom] = useState<Texture | null>(null);

  useEffect(() => () => cube.dispose(), [cube]);
  useEffect(() => () => room?.dispose(), [room]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    // Old mirror glass: some tiles a touch darker or warmer than their neighbours.
    const shade = new Color();
    all.forEach((tile, i) => {
      m.setMatrixAt(i, tile.matrix);
      const v = 0.55 + random() * 0.45;
      m.setColorAt(i, shade.setRGB(v, v * (0.97 + random() * 0.03), v * (0.94 + random() * 0.06)));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.instanceMatrix.needsUpdate = true;
  }, [all, random]);

  useFrame((state) => {
    const t = now();
    const angle = t * SPIN;
    const ball = spin.current;
    if (ball) ball.rotation.y = angle;

    // The mirrors reflect the room itself: once everything has drawn a frame,
    // photograph it from the ball's centre and hand that to the tiles. Once is
    // enough, since the ball's turning already sweeps each tile across it.
    frames.current += 1;
    if (frames.current === 2 && ball && glass.current) {
      ball.visible = false;
      const cam = new CubeCamera(0.2, 40, cube);
      cam.position.copy(BALL);
      cam.update(state.gl, state.scene);
      ball.visible = true;
      const pmrem = new PMREMGenerator(state.gl);
      const env = pmrem.fromCubemap(cube.texture).texture;
      pmrem.dispose();
      glass.current.envMap = env;
      glass.current.needsUpdate = true;
      setRoom(env);
    }

    // Each glint lives ~0.8 s on one tile facing the lens, then hops to another.
    picks.forEach((pick, i) => {
      const sprite = glints.current[i];
      if (!sprite) return;
      const period = 0.8;
      const local = t + (i * period) / GLINTS;
      const cycle = Math.floor(local / period);
      if (cycle !== pick.cycle) {
        pick.cycle = cycle;
        for (let tries = 0; tries < 40; tries++) {
          pick.tile = Math.floor(random() * all.length);
          world.n.copy(all[pick.tile].normal).applyAxisAngle(Y, angle);
          world.toEye.copy(state.camera.position).sub(BALL).normalize();
          if (world.n.dot(world.toEye) > 0.55) break;
        }
      }
      world.n.copy(all[pick.tile].normal).applyAxisAngle(Y, angle);
      world.p.copy(world.n).multiplyScalar(BALL_RADIUS * 1.02).add(BALL);
      sprite.position.copy(world.p);
      const life = (local % period) / period;
      const pulse = Math.sin(life * Math.PI) ** 3;
      sprite.scale.setScalar(0.15 + 1.25 * pulse);
      sprite.material.opacity = pulse;
    });
  });

  return (
    <group>
      <mesh position={[0, BALL.y + (11 - BALL.y) / 2 + BALL_RADIUS / 2, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 11 - BALL.y - BALL_RADIUS, 8]} />
        <meshStandardMaterial color="#5d6478" metalness={1} roughness={0.3} />
      </mesh>
      <group ref={spin} position={BALL}>
        <mesh>
          <sphereGeometry args={[BALL_RADIUS * 0.985, 48, 32]} />
          <meshStandardMaterial color="#07091a" roughness={0.9} />
        </mesh>
        <instancedMesh ref={mesh} args={[undefined, undefined, all.length]} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial ref={glass} color="#ffffff" metalness={1} roughness={0.05} envMapIntensity={3.6} />
        </instancedMesh>
      </group>
      {picks.map((_, i) => (
        <sprite
          key={i}
          ref={(s) => {
            glints.current[i] = s;
          }}
        >
          <spriteMaterial
            map={star}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
            color={[2.4, 2.2, 1.9]}
            toneMapped={false}
          />
        </sprite>
      ))}
    </group>
  );
}

const Y = new Vector3(0, 1, 0);
