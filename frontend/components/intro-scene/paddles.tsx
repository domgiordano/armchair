"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { CanvasTexture, type Group, type PerspectiveCamera, SRGBColorSpace } from "three";

import { PADDLES_UP, PADDLE_Y, PADDLE_Z, clamp01, easeOutBack } from "./timeline";

const FACE_W = 0.66;
const FACE_H = 0.52;
const GAP = 0.2;
const TILTS = [0.07, -0.02, -0.08];

// The display face is loaded lazily by next/font; draw once it's in, so the
// numerals aren't a fallback serif.
function useNumeral(text: string) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    let live = true;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim();
    const font = `400 330px ${family ? `${family}, ` : ""}"Arial Black", sans-serif`;
    const draw = () => {
      if (!live) return;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#10131f";
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.letterSpacing = "-18px";
      ctx.fillText(text, 256, 212);
      const t = new CanvasTexture(canvas);
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
      setTexture(t);
    };
    document.fonts.load(font).then(draw, draw);
    return () => {
      live = false;
    };
  }, [text]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

interface PaddlesProps {
  now: () => number;
}

/** Three judges' paddles, all tens, coming up from below the frame into the light. */
export function Paddles({ now }: PaddlesProps) {
  const row = useRef<Group>(null);
  const paddles = useRef<(Group | null)[]>([]);
  const numeral = useNumeral("10");
  const camera = useThree((s) => s.camera as PerspectiveCamera);

  useFrame(() => {
    const t = now();
    const g = row.current;
    if (!g) return;
    // Fit the row to the width at its depth, so a phone in portrait keeps all three.
    const depth = camera.position.z - PADDLE_Z;
    const halfWidth = depth * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    g.scale.setScalar(Math.min(1, (halfWidth * 0.86) / (FACE_W * 1.5 + GAP)));
    paddles.current.forEach((p, i) => {
      if (!p) return;
      const x = clamp01((t - PADDLES_UP - i * 0.11) / 0.62);
      p.position.y = -1.9 * (1 - easeOutBack(x));
      p.visible = x > 0;
    });
  });

  return (
    <group ref={row} position={[0, PADDLE_Y, PADDLE_Z]} rotation={[-0.12, 0, 0]}>
      {TILTS.map((tilt, i) => (
        <group
          key={i}
          ref={(p) => {
            paddles.current[i] = p;
          }}
          visible={false}
        >
          <group position={[(i - 1) * (FACE_W + GAP), 0, 0]} rotation={[0, -tilt * 1.4, tilt]}>
            <RoundedBox args={[FACE_W, FACE_H, 0.04]} radius={0.03} smoothness={4}>
              <meshPhysicalMaterial color="#f1eee6" roughness={0.38} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={0.35} />
            </RoundedBox>
            {numeral && (
              <mesh position={[0, 0, 0.0215]}>
                <planeGeometry args={[FACE_W * 0.94, FACE_H * 0.94]} />
                <meshStandardMaterial map={numeral} transparent roughness={0.3} envMapIntensity={0.6} />
              </mesh>
            )}
            <mesh position={[0, -FACE_H / 2 - 0.3, -0.005]}>
              <cylinderGeometry args={[0.028, 0.03, 0.62, 12]} />
              <meshStandardMaterial color="#1a1d2b" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
