"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  type MeshBasicMaterial,
  type ShaderMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";

import { BALL_REST, CEILING, DESK_LIGHT, DESK_TOP, DESK_Z, ROOM_RADIUS, ballY, phase } from "./timeline";

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, height = size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

// Pleated velvet, tiled round the room, brighter at the hem where the uplights sit.
function curtain() {
  const texture = canvasTexture(128, (ctx, size) => {
    for (let y = 0; y < size; y++) {
      const wash = Math.pow(y / size, 2.4);
      for (let x = 0; x < size; x++) {
        const fold = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 3);
        const l = (3 + fold * 6) * (0.4 + 1.5 * wash);
        ctx.fillStyle = `hsl(${226 + 10 * wash} 62% ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(30, 1);
  return texture;
}

// Midnight lacquer with a gold inlay ring and a faint star of boards.
function lacquer() {
  const texture = canvasTexture(1024, (ctx, size) => {
    const c = size / 2;
    ctx.fillStyle = "#070c28";
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(c, c);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.fillStyle = i % 2 ? "rgba(40,56,120,0.25)" : "rgba(4,8,30,0.3)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(c * 1.5, -c * 0.3);
      ctx.lineTo(c * 1.5, c * 0.3);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#c9a14f";
    ctx.lineWidth = 4;
    for (const r of [0.3, 0.308, 0.46]) {
      ctx.beginPath();
      ctx.arc(c, c, r * size, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  texture.anisotropy = 4;
  return texture;
}

/** A soft radial glow, white at the centre: haze, pools, halos. */
export function glowTexture() {
  return canvasTexture(128, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.2, "rgba(255,255,255,0.6)");
    g.addColorStop(0.5, "rgba(255,255,255,0.2)");
    g.addColorStop(0.75, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

// A cone of light in haze: brightest at the lamp, soft at its edges, gone by the floor.
const coneVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const coneFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float along = vUv.y;
    float soft = pow(abs(dot(normalize(vNormal), normalize(vView))), 2.0);
    float a = (0.2 + 0.8 * along * along) * smoothstep(0.0, 0.3, along);
    gl_FragColor = vec4(uColor * a * soft * uStrength, 1.0);
  }
`;

// Apex at the origin, opening along +z, one unit long: lookAt aims it, scale sizes it.
const CONE = new CylinderGeometry(0.02, 1, 1, 28, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);

interface BeamProps {
  now: () => number;
  from: [number, number, number];
  aim: (t: number, target: Vector3) => void;
  color: string;
  /** Radius of the pool it throws, in metres. */
  spread: number;
  strength: number;
  on?: (t: number) => number;
  pool?: boolean;
}

const ALWAYS = () => 1;

function Beam({ now, from, aim, color, spread, strength, on = ALWAYS, pool = true }: BeamProps) {
  const cone = useRef<Mesh>(null);
  const splash = useRef<Mesh>(null);
  const glow = useMemo(() => glowTexture(), []);
  const target = useMemo(() => new Vector3(), []);
  const uniforms = useMemo(() => ({ uColor: { value: new Color(color) }, uStrength: { value: 0 } }), [color]);

  useFrame(() => {
    const c = cone.current;
    if (!c) return;
    const t = now();
    aim(t, target);
    c.lookAt(target);
    c.scale.set(spread, spread, c.position.distanceTo(target));
    const level = on(t);
    (c.material as ShaderMaterial).uniforms.uStrength.value = strength * level;
    c.visible = level > 0.001;
    const s = splash.current;
    if (!s) return;
    s.position.set(target.x, 0.02, target.z);
    s.scale.setScalar(spread * 3.2);
    (s.material as MeshBasicMaterial).opacity = level * strength * 1.6;
  });

  return (
    <>
      <mesh ref={cone} position={from} renderOrder={4}>
        <primitive object={CONE} attach="geometry" />
        <shaderMaterial
          vertexShader={coneVertex}
          fragmentShader={coneFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {pool && (
        <mesh ref={splash} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={glow} color={color} transparent depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      )}
    </>
  );
}

const ball = (t: number, v: Vector3) => v.set(BALL_REST.x, ballY(t), BALL_REST.z);
const sweep = (x: number, speed: number, off: number) => (t: number, v: Vector3) =>
  v.set(x + Math.sin(t * speed + off) * 2.2, 0, -1.4 + Math.cos(t * speed * 0.8 + off) * 2.2);
const deskAt = (x: number) => (_: number, v: Vector3) => v.set(x, DESK_TOP, DESK_Z);
const onBall = (t: number) => 1 - phase(t, 1.6, 2.6);
const onFloor = (t: number) => phase(t, 0.6, 2.0) * (1 - 0.5 * phase(t, DESK_LIGHT, DESK_LIGHT + 0.4));
const onDesk = (t: number) => phase(t, DESK_LIGHT, DESK_LIGHT + 0.2);

const BULBS = 150;

// Marquee bulbs round the balcony rail and the floor's edge; bloom turns them into bokeh.
function Bulbs() {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new Matrix4();
    for (let i = 0; i < BULBS; i++) {
      const upper = i % 2 === 1;
      const a = ((i >> 1) / (BULBS / 2)) * Math.PI * 2 + (upper ? 0.02 : 0);
      const r = ROOM_RADIUS - 0.3;
      matrix.makeTranslation(Math.cos(a) * r, upper ? 7.4 : 2.3, Math.sin(a) * r);
      m.setMatrixAt(i, matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BULBS]}>
      <sphereGeometry args={[0.065, 8, 6]} />
      <meshBasicMaterial color={[3.2, 2.1, 1.0]} toneMapped={false} />
    </instancedMesh>
  );
}

interface NowProps {
  now: () => number;
}

// The backlight the dancers are silhouetted against, and its reflection in the lacquer.
function Haze({ now }: NowProps) {
  const glow = useMemo(() => glowTexture(), []);
  const up = useRef<MeshBasicMaterial>(null);
  const down = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    const level = 0.2 + 0.45 * phase(now(), 1.0, 2.4);
    if (up.current) up.current.opacity = level;
    if (down.current) down.current.opacity = level * 0.4;
  });
  return (
    <>
      <mesh position={[0, 2.2, -8]} scale={[16, 7, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={up} map={glow} color="#f2c97e" transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh position={[0, -2.2, -8]} scale={[16, 7, 1]} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={down} map={glow} color="#f2c97e" transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </>
  );
}

// Where the judges sit, front of the floor: dark until the spotlights find it.
function Desk({ now }: NowProps) {
  const trim = useRef<MeshBasicMaterial>(null);
  const wash = useRef<MeshBasicMaterial>(null);
  const glow = useMemo(() => glowTexture(), []);
  const gold = useMemo(() => new Color("#e8c268"), []);
  useFrame(() => {
    const lit = phase(now(), DESK_LIGHT, DESK_LIGHT + 0.25);
    trim.current?.color.copy(gold).multiplyScalar(0.25 + 1.6 * lit);
    if (wash.current) wash.current.opacity = 0.18 * lit;
  });
  return (
    <group position={[0, 0, DESK_Z]}>
      <mesh position={[0, DESK_TOP / 2, 0]}>
        <boxGeometry args={[7, DESK_TOP, 0.7]} />
        <meshBasicMaterial color="#070c26" />
      </mesh>
      <mesh position={[0, DESK_TOP, 0.36]}>
        <boxGeometry args={[7, 0.035, 0.035]} />
        <meshBasicMaterial ref={trim} color="#3a3120" toneMapped={false} />
      </mesh>
      <mesh position={[0, DESK_TOP * 0.18, 0.36]}>
        <boxGeometry args={[7, 0.02, 0.02]} />
        <meshBasicMaterial color="#3d3322" />
      </mesh>
      <mesh position={[0, DESK_TOP * 0.55, 0.36]} scale={[6, 1.6, 1]} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={wash} map={glow} color="#f5d28e" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function Room({ now }: NowProps) {
  const drape = useMemo(() => curtain(), []);
  const boards = useMemo(() => lacquer(), []);

  return (
    <group>
      <mesh position={[0, CEILING / 2, 0]}>
        <cylinderGeometry args={[ROOM_RADIUS, ROOM_RADIUS, CEILING, 96, 1, true]} />
        <meshBasicMaterial map={drape} side={BackSide} />
      </mesh>
      <mesh position={[0, CEILING, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ROOM_RADIUS, 48]} />
        <meshBasicMaterial color="#02051a" />
      </mesh>
      <Bulbs />
      <Haze now={now} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ROOM_RADIUS, 96]} />
        <meshBasicMaterial map={boards} transparent opacity={0.84} depthWrite={false} />
      </mesh>
      <Desk now={now} />

      <Beam now={now} from={[-8, 0.4, -3]} aim={ball} color="#ffd48f" spread={0.5} strength={0.5} on={onBall} pool={false} />
      <Beam now={now} from={[8, 0.4, -2]} aim={ball} color="#c9d6ff" spread={0.5} strength={0.4} on={onBall} pool={false} />
      <Beam now={now} from={[-4.8, 9, -7]} aim={sweep(-1.8, 0.7, 0.3)} color="#ffd48f" spread={1.3} strength={0.3} on={onFloor} />
      <Beam now={now} from={[-1.6, 9.5, -7.6]} aim={sweep(-0.6, 0.55, 2.1)} color="#dde4ff" spread={1.2} strength={0.24} on={onFloor} />
      <Beam now={now} from={[1.6, 9.5, -7.6]} aim={sweep(0.8, 0.6, 4.0)} color="#ffd48f" spread={1.2} strength={0.28} on={onFloor} />
      <Beam now={now} from={[4.8, 9, -7]} aim={sweep(2.0, 0.65, 5.2)} color="#dde4ff" spread={1.3} strength={0.24} on={onFloor} />
      <Beam now={now} from={[-7, 10, 3.5]} aim={deskAt(-1.2)} color="#ffe2a8" spread={1.4} strength={0.32} on={onDesk} pool={false} />
      <Beam now={now} from={[7, 10, 3.5]} aim={deskAt(1.2)} color="#ffe2a8" spread={1.4} strength={0.32} on={onDesk} pool={false} />
    </group>
  );
}
