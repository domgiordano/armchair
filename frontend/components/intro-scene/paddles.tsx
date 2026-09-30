"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasTexture, Color, type Group, type MeshBasicMaterial, type PerspectiveCamera, SRGBColorSpace, Vector3 } from "three";

import { type Star, Stars } from "./stars";
import { CARD_TIMES, DESK_TOP, DESK_Z, SCORES, clamp01, easeOutBack } from "./timeline";

const FACE_W = 0.62;
const FACE_H = 0.5;
const GAP = 0.22;
const REST_Y = DESK_TOP + 0.62;
const TILTS = [0.06, -0.01, -0.07];
const PEARL = new Color("#f3f1ea");

// Drawn at once, so the cards' shaders compile with the rest of the scene, and
// again when next/font's display face is in, so the numerals aren't a fallback.
function useNumerals() {
  const [textures, setTextures] = useState<CanvasTexture[] | null>(null);
  useEffect(() => {
    let live = true;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-archivo").trim();
    const font = `400 300px ${family ? `${family}, ` : ""}"Arial Black", sans-serif`;
    const draw = () => {
      if (!live) return;
      setTextures(
        SCORES.map((score) => {
          const canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = 412;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.strokeStyle = "#c9a14f";
            ctx.lineWidth = 10;
            ctx.strokeRect(22, 22, 468, 368);
            ctx.fillStyle = "#0b1233";
            ctx.font = font;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.letterSpacing = "-16px";
            ctx.fillText(String(score), 256, 220);
          }
          const t = new CanvasTexture(canvas);
          t.colorSpace = SRGBColorSpace;
          t.anisotropy = 8;
          return t;
        }),
      );
    };
    draw();
    document.fonts.load(font).then(draw, draw);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => () => textures?.forEach((t) => t.dispose()), [textures]);
  return textures;
}

interface PaddlesProps {
  now: () => number;
}

/** The judges' cards: 9, 10, 10, each popping up from the desk with a flash. */
export function Paddles({ now }: PaddlesProps) {
  const row = useRef<Group>(null);
  const cards = useRef<(Group | null)[]>([]);
  const faces = useRef<(MeshBasicMaterial | null)[]>([]);
  const numerals = useNumerals();
  const camera = useThree((s) => s.camera as PerspectiveCamera);
  const centre = useRef(new Vector3());

  useFrame(() => {
    const t = now();
    const g = row.current;
    if (!g) return;
    // Fit the row to the width at its depth, so a phone in portrait keeps all three.
    const depth = camera.position.z - DESK_Z;
    const halfWidth = depth * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    g.scale.setScalar(Math.min(1, (halfWidth * 0.8) / (FACE_W * 1.5 + GAP)));
    centre.current.copy(g.position);
    cards.current.forEach((card, i) => {
      if (!card) return;
      const x = clamp01((t - CARD_TIMES[i]) / 0.45);
      const pop = easeOutBack(x, 2.4);
      // Scaled to nothing rather than hidden, so its shaders compile with the rest.
      card.scale.setScalar(Math.max(0.0001, pop));
      card.position.y = -0.5 * (1 - pop);
      const flash = Math.exp(-Math.max(0, t - CARD_TIMES[i]) * 5) * (t >= CARD_TIMES[i] ? 1 : 0);
      faces.current[i]?.color.copy(PEARL).multiplyScalar(0.92 + 1.4 * flash);
    });
  });

  // A starburst behind each card as it lands.
  const burst = useCallback(
    (t: number, i: number, star: Star) => {
      const age = (t - CARD_TIMES[i]) / 0.5;
      if (age <= 0 || age >= 1) return;
      const g = row.current;
      const s = g ? g.scale.x : 1;
      star.position.set((i - 1) * (FACE_W + GAP) * s, REST_Y + 0.05, DESK_Z - 0.1);
      star.size = (0.8 + 2.6 * age) * s;
      star.angle = 0.3 + age * 0.6;
      star.color.setRGB(2.6, 2.1, 1.3).multiplyScalar((1 - age) ** 2);
    },
    [],
  );

  return (
    <>
      <group ref={row} position={[0, REST_Y, DESK_Z]} rotation={[-0.05, 0, 0]}>
        {TILTS.map((tilt, i) => (
          <group
            key={i}
            position={[(i - 1) * (FACE_W + GAP), 0, 0]}
            ref={(c) => {
              cards.current[i] = c;
            }}
          >
            <group rotation={[0, -tilt * 1.4, tilt]}>
              <RoundedBox args={[FACE_W, FACE_H, 0.04]} radius={0.035} smoothness={3}>
                <meshBasicMaterial
                  ref={(m) => {
                    faces.current[i] = m;
                  }}
                  color={PEARL}
                  toneMapped={false}
                />
              </RoundedBox>
              {numerals && (
                <mesh position={[0, 0, 0.0215]}>
                  <planeGeometry args={[FACE_W * 0.94, FACE_H * 0.94]} />
                  <meshBasicMaterial map={numerals[i]} transparent toneMapped={false} />
                </mesh>
              )}
              <mesh position={[0, -FACE_H / 2 - 0.28, -0.005]}>
                <cylinderGeometry args={[0.026, 0.028, 0.56, 10]} />
                <meshBasicMaterial color="#1a1d2b" />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      <Stars count={3} now={now} place={burst} />
    </>
  );
}
