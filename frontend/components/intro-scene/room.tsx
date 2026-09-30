"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BackSide,
  CanvasTexture,
  Color,
  type InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
} from "three";

import { CEILING, ROOM_RADIUS } from "./timeline";

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Pleated velvet: a horizontal run of soft vertical folds, tiled round the room.
// Brighter at the hem, where the uplights sit, so it doubles as the emissive wash.
function curtain() {
  const texture = canvasTexture(256, (ctx, size) => {
    for (let y = 0; y < size; y++) {
      const wash = Math.pow(y / size, 2.2);
      for (let x = 0; x < size; x++) {
        const fold = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 3);
        const l = (4 + fold * 9) * (0.35 + 1.4 * wash);
        ctx.fillStyle = `hsl(${228 + 14 * wash} 70% ${l}%)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(26, 1);
  return texture;
}

// Dark lacquer with a gold inlay ring and a faint star of boards meeting in the middle.
function floor() {
  return canvasTexture(1024, (ctx, size) => {
    const c = size / 2;
    ctx.fillStyle = "#0a1034";
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(c, c);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.fillStyle = i % 2 ? "rgba(40,56,120,0.35)" : "rgba(10,16,48,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(c * 1.5, -c * 0.3);
      ctx.lineTo(c * 1.5, c * 0.3);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 5;
    for (const r of [0.17, 0.178, 0.33]) {
      ctx.strokeStyle = "#caa24e";
      ctx.beginPath();
      ctx.arc(c, c, r * size, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

/**
 * What the mirrors and the lacquer reflect: a dark room ringed with warm
 * lights and a couple of cool follow-spots. Built once into a PMREM map, so
 * there's no HDR file to fetch.
 */
function useStudioEnvironment() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const room = new Scene();
    room.background = new Color("#141c44");
    const panel = (color: string, w: number, h: number, x: number, y: number, z: number, gain = 1) => {
      const material = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(gain) });
      const mesh = new Mesh(new PlaneGeometry(w, h), material);
      mesh.position.set(x, y, z);
      mesh.lookAt(0, 0, 0);
      room.add(mesh);
    };
    // A scatter of small lamps all round, so tiles facing any way can catch one.
    for (let i = 0; i < 220; i++) {
      const y = 1 - (2 * (i + 0.5)) / 220;
      const a = i * 2.39996;
      const r = Math.sqrt(1 - y * y);
      const tone = i % 4 === 0 ? "#cfe0ff" : i % 3 === 0 ? "#ffc96b" : "#fff4de";
      panel(tone, 1.1, 1.1, Math.cos(a) * r * 8, y * 8, Math.sin(a) * r * 8, i % 3 === 0 ? 6 : 1.4);
    }
    panel("#cfe0ff", 3, 3, -6, 6, 3);
    panel("#ffe3b0", 3, 3, 6, 5, -2);
    panel("#e7b2ff", 2, 2, 0, -6, 5);
    panel("#1c2c7a", 20, 4, 0, -7, 0);
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(room, 0.005);
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as MeshBasicMaterial).dispose();
        }
      });
    };
  }, [get]);
}

const BULBS = 140;

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
      const r = ROOM_RADIUS - 0.25;
      matrix.makeTranslation(Math.cos(a) * r, upper ? 7.2 : 2.1, Math.sin(a) * r);
      m.setMatrixAt(i, matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BULBS]}>
      <sphereGeometry args={[0.06, 8, 6]} />
      <meshBasicMaterial color={[4, 2.6, 1.2]} toneMapped={false} />
    </instancedMesh>
  );
}

interface RoomProps {
  mobile: boolean;
}

export function Room({ mobile }: RoomProps) {
  useStudioEnvironment();
  const drape = useMemo(() => curtain(), []);
  const boards = useMemo(() => floor(), []);

  return (
    <group>
      <mesh position={[0, CEILING / 2, 0]}>
        <cylinderGeometry args={[ROOM_RADIUS, ROOM_RADIUS, CEILING, 96, 1, true]} />
        <meshStandardMaterial
          map={drape}
          emissiveMap={drape}
          emissive="#6d86ff"
          emissiveIntensity={0.9}
          side={BackSide}
          roughness={0.85}
          envMapIntensity={0.02}
        />
      </mesh>
      <mesh position={[0, CEILING, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ROOM_RADIUS, 64]} />
        <meshStandardMaterial color="#03061a" roughness={1} envMapIntensity={0} />
      </mesh>
      <Bulbs />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ROOM_RADIUS, 96]} />
        <MeshReflectorMaterial
          map={boards}
          resolution={mobile ? 512 : 1024}
          blur={[160, 60]}
          mixBlur={0.6}
          mixStrength={6}
          mirror={0.6}
          roughness={1}
          metalness={0}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          envMapIntensity={0}
        />
      </mesh>
    </group>
  );
}
