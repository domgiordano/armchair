"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  type InstancedMesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  SphereGeometry,
  SplineCurve,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { quad, seeds, voidMaterial } from "./billboard";
import { FIGURES, hoodFall, type Pose, pose, STRIDE, VOID, voidOpen } from "./timeline";

// Hooded figures in deep green cloaks, built from two surfaces: a body that
// flares to the hem, and a pointed hood open at the front. Inside, everything
// is pure black. No face is modelled, ever: under the hood there is only the
// void. Metres, facing +z, feet at the origin.

const HEAD = new Vector3(0, VOID.y, 0);
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** A grid surface from a function of (u around, v along); a closed one has its seam welded. */
function surface(cols: number, rows: number, at: (u: number, v: number, out: Vector3) => void, closed: boolean) {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
  const p = new Vector3();
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const k = j * (cols + 1) + i;
      at(i / cols, j / rows, p);
      pos.set([p.x, p.y, p.z], k * 3);
      uv.set([i / cols, j / rows], k * 2);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + cols + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  const n = g.getAttribute("normal") as BufferAttribute;
  // A seam that closes on itself shades as one surface.
  if (closed) {
    for (let j = 0; j <= rows; j++) {
      const a = j * (cols + 1);
      const b = a + cols;
      const sum = new Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
      n.setXYZ(a, sum.x, sum.y, sum.z);
      n.setXYZ(b, sum.x, sum.y, sum.z);
    }
  }
  return g;
}

/** Turns the triangles round if they face inwards, judged by the z of the normal at a probe vertex. */
function outward(g: BufferGeometry, probe: number, facing: 1 | -1) {
  const index = g.getIndex();
  if (!index || g.getAttribute("normal").getZ(probe) * facing >= 0) return g;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, a);
  }
  const n = g.getAttribute("normal");
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

// Radius against height, hem to neck.
const PROFILE = new SplineCurve(
  [
    [0.47, 0],
    [0.41, 0.3],
    [0.34, 0.65],
    [0.285, 1.0],
    [0.265, 1.22],
    [0.25, 1.36],
    [0.2, 1.45],
    [0.1, 1.51],
    [0.001, 1.53],
  ].map(([r, y]) => new Vector2(r, y)),
);

function body() {
  const COLS = 64;
  const ROWS = 40;
  const g = surface(
    COLS,
    ROWS,
    (u, v, out) => {
      const { x: r0, y } = PROFILE.getPoint(v);
      const a = u * Math.PI * 2;
      const fold = 0.08 * (1 - v) ** 1.3 * smooth(0.95, 0.75, v);
      const wrap = Math.atan2(Math.sin(a), Math.cos(a));
      // Where the cloak closes down the front, a shadowed overlap.
      const seam = 0.07 * Math.exp(-(wrap * wrap) / 0.012) * smooth(0.92, 0.7, v);
      const r = r0 * (1 + fold * (0.6 * Math.sin(7 * a + 0.6 + v * 1.5) + 0.4 * Math.sin(12 * a + 1.9))) * (1 - seam);
      const depth = 0.74 + 0.14 * (1 - v);
      out.set(r * Math.sin(a), y + (v === 0 ? 0.018 * Math.sin(9 * a) : 0), r * Math.cos(a) * depth);
    },
    true,
  );
  return outward(g, Math.round(ROWS / 2) * (COLS + 1), 1);
}

function hood() {
  const COLS = 40;
  const ROWS = 28;
  const R = 0.17;
  const g = surface(
    COLS,
    ROWS,
    (s, v, out) => {
      const phi = v * 1.95;
      // The opening: narrow at the crown, widest across the face, wrapping in under the chin.
      const half = 0.2 + 0.68 * smooth(0.1, 0.55, phi) - 0.3 * smooth(1.25, 1.8, phi);
      const a = half + s * (Math.PI * 2 - 2 * half);
      const r = R * (1 + 0.55 * smooth(1.2, 1.95, phi));
      const back = Math.max(0, -Math.cos(a));
      // Pointed at the back of the crown, lip drawn forward round the opening.
      const lip = Math.exp(-Math.min(s, 1 - s) * 30) * smooth(0.2, 0.6, phi);
      const x = r * Math.sin(phi) * Math.sin(a);
      const y = HEAD.y + r * Math.cos(phi) + 0.05 * back * smooth(0.6, 0, phi) - 0.09 * smooth(1.4, 1.95, phi);
      const front = Math.cos(a) > 0 ? 1.18 : 1;
      const z = r * Math.sin(phi) * Math.cos(a) * front - 0.1 * back * back * smooth(0.15, 0.8, phi) + 0.035 * lip - 0.015;
      out.set(x, y, z);
    },
    false,
  );
  // Probed round the back, where an outward normal faces -z.
  return outward(g, Math.round(ROWS / 2) * (COLS + 1) + COLS / 2, -1);
}

// Hem sway with each step, and a breath of draught when they stand.
const cloth = { uTime: { value: 0 }, uWalk: { value: 1 } };

function cloak() {
  const m = new MeshPhysicalMaterial({
    color: "#0d2e1c",
    roughness: 0.82,
    sheen: 1,
    sheenColor: "#3f8a5e",
    sheenRoughness: 0.42,
    side: DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = cloth.uTime;
    shader.uniforms.uWalk = cloth.uWalk;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWalk;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vec3 root = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
  float hem = clamp(1.0 - position.y / 1.4, 0.0, 1.0);
  hem *= hem;
  float footfall = sin(root.z / ${STRIDE.toFixed(2)} * 3.14159);
  transformed.x += hem * (uWalk * 0.045 * footfall + 0.012 * sin(uTime * 1.3 + root.x * 3.0));
  transformed.z -= hem * uWalk * (0.05 - 0.025 * abs(footfall));`,
      );
    // The inside of a cloak or hood is pure black.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      "#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);",
    );
  };
  return m;
}

const black = new MeshBasicMaterial({ color: "#000000", fog: false, toneMapped: false });
const voidUniforms = { uTime: { value: 0 }, uOpen: { value: 0 } };

interface Clocked {
  now: () => number;
}

/** The procession: the lead on their own (their hood falls), the rest as one instanced mesh. */
export function Figures({ now }: Clocked) {
  const material = useMemo(() => cloak(), []);
  const parts = useMemo(() => ({ body: body(), hood: hood() }), []);
  const whole = useMemo(() => {
    const g = mergeGeometries([parts.body.clone(), parts.hood.clone()]);
    if (!g) throw new Error("figure geometry failed to merge");
    return g;
  }, [parts]);
  const head = useMemo(() => {
    const g = new SphereGeometry(1, 20, 14);
    g.scale(0.105, 0.13, 0.112);
    g.translate(HEAD.x, HEAD.y, HEAD.z + 0.01);
    return g;
  }, []);
  const halo = useMemo(() => {
    const g = quad();
    g.setAttribute("aSeed", seeds(1));
    return g;
  }, []);
  const haloMaterial = useMemo(() => voidMaterial(voidUniforms), []);

  const lead = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const rest = useRef<InstancedMesh>(null);
  const voidMesh = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => ({ o: new Object3D(), pose: { position: new Vector3(), yaw: 0, walk: 0 } as Pose }), []);

  useFrame(() => {
    const t = now();
    const { o, pose: p } = scratch;
    pose(0, t, p);
    cloth.uTime.value = t;
    cloth.uWalk.value = p.walk;
    lead.current?.position.copy(p.position);
    lead.current?.rotation.set(0, p.yaw, 0);
    for (let i = 1; i < FIGURES; i++) {
      pose(i, t, p);
      o.position.copy(p.position);
      o.rotation.set(0, p.yaw, 0);
      o.updateMatrix();
      rest.current?.setMatrixAt(i - 1, o.matrix);
    }
    if (rest.current) rest.current.instanceMatrix.needsUpdate = true;

    // Back over the crown and down onto the shoulders, folding as it goes.
    const fall = hoodFall(t);
    pivot.current?.rotation.set(-1.25 * fall, 0, 0);
    pivot.current?.scale.set(1 + 0.08 * fall, 1 - 0.45 * Math.min(fall, 1), 1 - 0.15 * fall);
    pivot.current?.position.set(0, 1.5 - 0.1 * fall, -0.12 - 0.1 * fall);

    const open = voidOpen(t);
    voidUniforms.uTime.value = t;
    voidUniforms.uOpen.value = open;
    if (voidMesh.current) {
      voidMesh.current.visible = open > 0;
      voidMesh.current.setMatrixAt(0, o.matrix.makeScale(1.3, 1.3, 1).setPosition(VOID));
      voidMesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={lead}>
        <mesh geometry={parts.body} material={material} />
        <group ref={pivot} position={[0, 1.5, -0.12]}>
          <mesh geometry={parts.hood} material={material} position={[0, -1.5, 0.12]} />
        </group>
        <mesh geometry={head} material={black} />
      </group>
      <instancedMesh ref={rest} args={[whole, material, FIGURES - 1]} frustumCulled={false} />
      <instancedMesh ref={voidMesh} args={[halo, haloMaterial, 1]} frustumCulled={false} renderOrder={10} />
    </>
  );
}
