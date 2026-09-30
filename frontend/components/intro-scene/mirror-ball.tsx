"use client";

import { useFrame } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Color, Euler, type Group, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

import { type Star, Stars } from "./stars";
import { BALL_RADIUS, BALL_REST, CEILING, SPIN, ballY, clamp01 } from "./timeline";

const TILE = 0.2;
const GAP = 0.028;
const GLINTS = 5;
const SPARKLES = 44;

interface Tile {
  normal: Vector3;
  matrix: Matrix4;
}

// Rings of square mirrors from pole to pole, each nudged a little off true so
// neighbouring tiles flash at different moments.
function tiles(random: () => number): Tile[] {
  const rings = Math.round((Math.PI * BALL_RADIUS) / TILE);
  const out: Tile[] = [];
  const tilt = new Euler();
  const z = new Vector3(0, 0, 1);
  for (let i = 0; i < rings; i++) {
    const lat = -Math.PI / 2 + ((i + 0.5) * Math.PI) / rings;
    const count = Math.max(1, Math.round((2 * Math.PI * BALL_RADIUS * Math.cos(lat)) / TILE));
    const offset = random() * Math.PI;
    for (let j = 0; j < count; j++) {
      const lon = offset + (j * 2 * Math.PI) / count;
      const normal = new Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const q = new Quaternion().setFromUnitVectors(z, normal);
      tilt.set((random() - 0.5) * 0.1, (random() - 0.5) * 0.1, 0);
      q.multiply(new Quaternion().setFromEuler(tilt));
      const size = TILE - GAP;
      const matrix = new Matrix4().compose(
        normal.clone().multiplyScalar(BALL_RADIUS),
        q,
        new Vector3(size, size * Math.min(1, 0.5 + Math.cos(lat)), 1),
      );
      out.push({ normal, matrix });
    }
  }
  return out;
}

// Each tile is one flat colour: what it would reflect of a stylised room (navy
// above, a warm band of bulbs at the horizon, a gold and a silver key light),
// worked out once per tile in the vertex shader. Big, clean flashes instead of
// a photographic smear.
const vertex = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vUv;
  vec3 room(vec3 r) {
    vec3 c = mix(vec3(0.015, 0.02, 0.06), vec3(0.07, 0.09, 0.24), smoothstep(-0.7, 0.5, r.y));
    c += vec3(0.95, 0.66, 0.3) * 0.35 * exp(-pow((r.y + 0.08) * 6.0, 2.0));
    c += vec3(1.0, 0.8, 0.46) * 5.0 * pow(max(dot(r, normalize(vec3(-0.75, -0.05, 0.65))), 0.0), 60.0);
    c += vec3(0.82, 0.88, 1.0) * 4.0 * pow(max(dot(r, normalize(vec3(0.7, 0.15, 0.7))), 0.0), 60.0);
    return c;
  }
  void main() {
    vUv = uv;
    mat4 world = modelMatrix * instanceMatrix;
    vec3 n = normalize(mat3(world) * vec3(0.0, 0.0, 1.0));
    vec3 p = (world * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 v = normalize(cameraPosition - p);
    vColor = room(reflect(-v, n)) * instanceColor;
    gl_Position = projectionMatrix * viewMatrix * world * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  varying vec3 vColor;
  varying vec2 vUv;
  void main() {
    // A bevelled edge, so the grid reads even on tiles facing the dark.
    vec2 d = abs(vUv - 0.5) * 2.0;
    float edge = smoothstep(0.7, 1.0, max(d.x, d.y));
    gl_FragColor = vec4(vColor * (1.0 - 0.45 * edge) + vec3(0.03, 0.035, 0.07) * edge, 1.0);
  }
`;

interface MirrorBallProps {
  random: () => number;
  now: () => number;
}

export function MirrorBall({ random, now }: MirrorBallProps) {
  const rig = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const all = useMemo(() => tiles(random), [random]);
  const picks = useRef(Array.from({ length: GLINTS }, () => ({ tile: 0, cycle: -1 })));
  const sparks = useMemo(
    () =>
      Array.from({ length: SPARKLES }, (_, i) => {
        // Out across the frame, mostly sideways and towards the lens.
        const a = random() * Math.PI * 2;
        const dir = new Vector3(Math.cos(a), Math.sin(a) * 0.8 - 0.15, 0.35 + random() * 0.7).normalize();
        return {
          dir,
          reach: 1.4 + random() * 3.2,
          born: 0.08 + (i / SPARKLES) * 0.85 + random() * 0.1,
          life: 1.1 + random() * 0.6,
          size: 0.16 + random() * 0.2,
          spin: (random() - 0.5) * 3,
          gold: i % 3 !== 0,
        };
      }),
    [random],
  );
  const world = useMemo(() => ({ n: new Vector3(), toEye: new Vector3(), centre: new Vector3() }), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const shade = new Color();
    all.forEach((tile, i) => {
      m.setMatrixAt(i, tile.matrix);
      const v = 0.7 + random() * 0.3;
      m.setColorAt(i, shade.setRGB(v, v * (0.97 + random() * 0.03), v * (0.93 + random() * 0.07)));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.instanceMatrix.needsUpdate = true;
  }, [all, random]);

  useFrame(() => {
    const t = now();
    if (rig.current) rig.current.position.y = ballY(t);
    if (spin.current) spin.current.rotation.y = t * SPIN;
  });

  // Glints: each lives ~0.9 s on a tile facing the lens, then hops to another.
  const glint = useCallback(
    (t: number, i: number, star: Star, eye: Vector3) => {
      const angle = t * SPIN;
      world.centre.set(BALL_REST.x, ballY(t), BALL_REST.z);
      const period = 0.9;
      const local = t + (i * period) / GLINTS;
      const cycle = Math.floor(local / period);
      const pick = picks.current[i];
      if (cycle !== pick.cycle) {
        pick.cycle = cycle;
        for (let tries = 0; tries < 40; tries++) {
          pick.tile = Math.floor(random() * all.length);
          world.n.copy(all[pick.tile].normal).applyAxisAngle(Y, angle);
          world.toEye.copy(eye).sub(world.centre).normalize();
          if (world.n.dot(world.toEye) > 0.6) break;
        }
      }
      world.n.copy(all[pick.tile].normal).applyAxisAngle(Y, angle);
      star.position.copy(world.n).multiplyScalar(BALL_RADIUS * 1.03).add(world.centre);
      const pulse = Math.sin(((local % period) / period) * Math.PI) ** 3;
      star.size = 0.1 + 0.75 * pulse;
      star.angle = 0.2;
      star.color.setRGB(2.2, 2.0, 1.7).multiplyScalar(pulse);
    },
    [all, picks, random, world],
  );

  // Sparkles thrown off the ball in the opening, drifting out and winking away.
  const sparkle = useCallback(
    (t: number, i: number, star: Star) => {
      const s = sparks[i];
      const age = (t - s.born) / s.life;
      if (age <= 0 || age >= 1) return;
      const out = 1 - Math.exp(-age * 4);
      world.centre.set(BALL_REST.x, ballY(t), BALL_REST.z);
      star.position.copy(s.dir).multiplyScalar(BALL_RADIUS + s.reach * out).add(world.centre);
      star.position.y -= age * age * 0.6;
      const twinkle = 0.75 + 0.25 * Math.sin(t * 14 + i);
      const fade = clamp01(age * 8) * (1 - age) ** 1.5;
      star.size = s.size * (0.6 + 0.8 * fade) * twinkle;
      star.angle = s.spin * age;
      if (s.gold) star.color.setRGB(2.4, 1.75, 0.8).multiplyScalar(fade);
      else star.color.setRGB(1.9, 2.0, 2.3).multiplyScalar(fade);
    },
    [sparks, world],
  );

  return (
    <group>
      <group ref={rig} position={BALL_REST}>
        <mesh position={[0, (CEILING - BALL_REST.y + BALL_RADIUS) / 2 + 2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, CEILING - BALL_REST.y + 4, 6]} />
          <meshBasicMaterial color="#39405a" />
        </mesh>
        <group ref={spin}>
          <mesh>
            <sphereGeometry args={[BALL_RADIUS * 0.98, 32, 24]} />
            <meshBasicMaterial color="#060a1c" />
          </mesh>
          <instancedMesh ref={mesh} args={[undefined, undefined, all.length]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <shaderMaterial vertexShader={vertex} fragmentShader={fragment} />
          </instancedMesh>
        </group>
      </group>
      <Stars count={GLINTS} now={now} place={glint} />
      <Stars count={SPARKLES} now={now} place={sparkle} />
    </group>
  );
}

const Y = new Vector3(0, 1, 0);
