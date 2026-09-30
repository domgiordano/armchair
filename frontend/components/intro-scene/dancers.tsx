"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  type BufferGeometry,
  CapsuleGeometry,
  type Group,
  LatheGeometry,
  type Mesh,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { DESK_LIGHT, envelope, phase } from "./timeline";

// Couples in closed hold, built from a handful of capsules and lathes and lit
// only from behind: dark figures with a warm rim, so they read as dancers
// without being anybody. Everything below is in metres, in the couple's frame:
// the man faces +z, the woman faces him, each offset to the other's right.

const UP = new Vector3(0, 1, 0);

function limb(a: [number, number, number], b: [number, number, number], r: number) {
  const from = new Vector3(...a);
  const to = new Vector3(...b);
  const along = to.clone().sub(from);
  const g = new CapsuleGeometry(r, along.length(), 3, 8);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, along.normalize()));
  const mid = new Vector3(...a).add(new Vector3(...b)).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

function ball(at: [number, number, number], r: number, squash: [number, number, number] = [1, 1, 1]) {
  const g = new SphereGeometry(r, 12, 10);
  g.scale(...squash);
  g.translate(...at);
  return g;
}

// Profiles run bottom to top, or the faces point inwards.
function lathe(profile: [number, number][], depth: number) {
  const g = new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    32,
  );
  g.scale(1, 1, depth);
  return g;
}

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("dancer geometry failed to merge");
  return merged;
}

// The man's hips and the woman's waist are the pivots the moves bend at.
const HIPS = new Vector3(0.07, 0.95, -0.17);
const WAIST = new Vector3(-0.07, 1.0, 0.17);

function manLegs() {
  const [x, y, z] = HIPS.toArray();
  return merge([
    limb([x + 0.09, y - 0.02, z], [x + 0.11, 0.07, z - 0.05], 0.078),
    limb([x - 0.09, y - 0.02, z], [x - 0.13, 0.07, z + 0.06], 0.078),
    // Tailcoat tails.
    limb([x + 0.07, y + 0.02, z - 0.1], [x + 0.06, y - 0.42, z - 0.16], 0.05),
    limb([x - 0.07, y + 0.02, z - 0.1], [x - 0.06, y - 0.42, z - 0.16], 0.05),
  ]);
}

// Relative to the hips. His frame: left hand up and out holding hers, right hand on her back.
function manUpper() {
  return merge([
    lathe(
      [
        [0.001, -0.02],
        [0.17, 0.0],
        [0.175, 0.2],
        [0.23, 0.4],
        [0.235, 0.47],
        [0.14, 0.54],
        [0.001, 0.56],
      ],
      0.7,
    ),
    limb([0, 0.52, 0], [0.01, 0.62, 0.01], 0.052),
    ball([0.03, 0.72, 0.02], 0.108, [0.92, 1.08, 1]),
    limb([0.2, 0.45, 0], [0.43, 0.46, 0.07], 0.058),
    limb([0.43, 0.46, 0.07], [0.41, 0.66, 0.2], 0.05),
    limb([-0.2, 0.45, 0], [-0.32, 0.32, 0.17], 0.058),
    limb([-0.32, 0.32, 0.17], [-0.1, 0.33, 0.43], 0.05),
  ]);
}

// Hanging from the waist.
function skirt() {
  return lathe(
    [
      [0.001, -0.99],
      [0.6, -0.99],
      [0.55, -0.93],
      [0.4, -0.72],
      [0.25, -0.4],
      [0.15, -0.12],
      [0.12, 0.0],
      [0.001, 0.02],
    ],
    1,
  );
}

// Relative to the waist: head turned out to her left, right hand in his, left on his shoulder.
function womanUpper() {
  return merge([
    lathe(
      [
        [0.001, -0.02],
        [0.1, 0.0],
        [0.12, 0.13],
        [0.155, 0.3],
        [0.16, 0.36],
        [0.09, 0.41],
        [0.001, 0.43],
      ],
      0.66,
    ),
    limb([0, 0.4, 0], [-0.01, 0.5, 0.04], 0.042),
    ball([-0.05, 0.57, 0.08], 0.094, [0.92, 1.08, 1]),
    ball([-0.06, 0.61, 0.17], 0.058),
    limb([0.14, 0.35, 0], [0.34, 0.43, -0.05], 0.042),
    limb([0.34, 0.43, -0.05], [0.53, 0.62, -0.13], 0.036),
    limb([-0.14, 0.35, 0], [-0.26, 0.42, -0.15], 0.042),
    limb([-0.26, 0.42, -0.15], [-0.08, 0.4, -0.31], 0.036),
  ]);
}

const vertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
// Rim light from behind and above: the edge of the figure picks up the haze.
const fragment = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uRim;
  uniform float uLevel;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float edge = pow(1.0 - abs(dot(n, v)), 4.0);
    float back = 0.15 + 0.85 * max(dot(n, normalize(vec3(0.0, 0.5, -1.0))), 0.0);
    gl_FragColor = vec4(uBody + uRim * edge * back * uLevel, 1.0);
  }
`;

// Shared by both copies of the floor, so one write dims the reflection too.
const LEVEL = { value: 1 };

function silhouetteMaterial(level: { value: number }) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uBody: { value: new Vector3(0.006, 0.008, 0.022) },
      uRim: { value: new Vector3(1.9, 1.35, 0.7) },
      uLevel: level,
    },
  });
}

interface Move {
  from: number;
  to: number;
}

interface CoupleSpec {
  /** Where they circle on the floor, and how wide. */
  centre: [number, number];
  orbit: number;
  /** Radians per second round the orbit (the line of dance) and round themselves. */
  travel: number;
  turn: number;
  offset: number;
  dip?: Move;
  lift?: Move;
}

// Five couples, two with a featured move while the camera is on the floor.
const COUPLES: CoupleSpec[] = [
  { centre: [0.1, -0.2], orbit: 0.55, travel: 0.9, turn: 3.2, offset: 0.4, dip: { from: 2.2, to: 3.35 } },
  { centre: [-2.3, -1.5], orbit: 0.5, travel: 1.0, turn: 3.6, offset: 2.1, lift: { from: 1.9, to: 3.0 } },
  { centre: [2.4, -1.1], orbit: 0.5, travel: 0.8, turn: 3.4, offset: 4.2 },
  { centre: [-1.0, -3.8], orbit: 0.6, travel: 0.9, turn: 3.0, offset: 1.0 },
  { centre: [1.5, -4.1], orbit: 0.6, travel: 1.1, turn: 3.3, offset: 5.3, lift: { from: 3.0, to: 4.2 } },
];

interface Parts {
  root: Group | null;
  man: Mesh | null;
  woman: Group | null;
  torso: Mesh | null;
  skirt: Mesh | null;
}

function pose(spec: CoupleSpec, t: number, p: Parts) {
  const { root, man, woman, torso, skirt } = p;
  if (!root || !man || !woman || !torso || !skirt) return;
  const dip = spec.dip ? envelope(t, spec.dip.from, spec.dip.to, 0.45, 0.45) : 0;
  const lift = spec.lift ? envelope(t, spec.lift.from, spec.lift.to, 0.4, 0.45) : 0;
  // Turning slows right down through a dip; a lift spins faster.
  const hold = spec.dip ? (spec.dip.to - spec.dip.from) * 0.8 * phase(t, spec.dip.from - 0.2, spec.dip.to + 0.2) : 0;
  const whirl = spec.lift ? (spec.lift.to - spec.lift.from) * 0.6 * phase(t, spec.lift.from, spec.lift.to) : 0;
  const a = spec.offset + t * spec.travel;
  root.position.set(spec.centre[0] + Math.cos(a) * spec.orbit, 0, spec.centre[1] + Math.sin(a) * spec.orbit);
  root.rotation.y = spec.offset * 2 + spec.turn * (t - hold + whirl);
  // Rise and fall on the waltz's one-two-three, and a sway into the turn.
  const beat = (t * 2.2 + spec.offset) % 1;
  root.position.y = 0.035 * Math.sin(beat * Math.PI) * (1 - dip) * (1 - lift);
  root.rotation.z = 0.05 * Math.sin(t * 2.2 * Math.PI * (2 / 3) + spec.offset) * (1 - dip);

  // Dip: he leans in over her, she arches back from the waist and sinks.
  // Lift: she's up at his chest, tipped out by the spin, the gown trailing.
  man.rotation.x = 0.4 * dip - 0.1 * lift;
  woman.position.set(WAIST.x, WAIST.y - 0.28 * dip + 0.7 * lift, WAIST.z + 0.1 * dip + 0.06 * lift);
  woman.rotation.x = 0.55 * lift;
  torso.rotation.x = 0.2 + 1.15 * dip - 0.5 * lift;
  const flare = 1.1 + 0.12 * Math.sin(beat * Math.PI * 2) - 0.35 * lift;
  skirt.scale.set(flare, 1 - 0.1 * lift, flare);
  skirt.rotation.x = 0.15 * dip + 0.3 * lift;
}

interface DancersProps {
  now: () => number;
}

/** The couples on the floor. Rendered twice, once mirrored under the lacquer for the reflection. */
export function Dancers({ now }: DancersProps) {
  const geo = useMemo(() => ({ legs: manLegs(), man: manUpper(), skirt: skirt(), woman: womanUpper() }), []);
  const material = useMemo(() => silhouetteMaterial(LEVEL), []);
  const parts = useRef<Parts[]>(COUPLES.map(() => ({ root: null, man: null, woman: null, torso: null, skirt: null })));

  useFrame(() => {
    const t = now();
    // Down a touch once the spotlights swing to the judges.
    LEVEL.value = 1 - 0.45 * phase(t, DESK_LIGHT, DESK_LIGHT + 0.5);
    COUPLES.forEach((spec, i) => pose(spec, t, parts.current[i]));
  });

  return (
    <group>
      {COUPLES.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            parts.current[i].root = g;
          }}
        >
          <mesh geometry={geo.legs} material={material} />
          <mesh
            ref={(m) => {
              parts.current[i].man = m;
            }}
            geometry={geo.man}
            material={material}
            position={HIPS}
          />
          <group
            ref={(g) => {
              parts.current[i].woman = g;
            }}
            position={WAIST}
          >
            <mesh
              ref={(m) => {
                parts.current[i].skirt = m;
              }}
              geometry={geo.skirt}
              material={material}
            />
            <mesh
              ref={(m) => {
                parts.current[i].torso = m;
              }}
              geometry={geo.woman}
              material={material}
            />
          </group>
        </group>
      ))}
    </group>
  );
}
