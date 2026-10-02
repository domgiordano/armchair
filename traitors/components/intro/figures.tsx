"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  type InstancedMesh,
  type Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Object3D,
  SphereGeometry,
  SplineCurve,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { quad, voidMaterial } from "./billboard";
import { FIGURES, HEAD_Y, hoodSlide, type Pose, pose, STRIDE, VOID, voidOpen } from "./timeline";

// Hooded figures in heavy dark-green cloaks: a body that flares to a dragging
// hem, and a deep hood open at the front. Inside, everything is pure black. No
// face is modelled, ever: under the hood there is only the void. Metres,
// facing +z, feet at the origin. They're lit from behind, so the silhouette is
// what has to be right; the surfaces are dense enough that no edge shows a facet.

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** A grid surface from a function of (u around, v along); a closed one has its seam welded. */
function surface(cols: number, rows: number, at: (u: number, v: number, out: Vector3) => void, closed: boolean) {
  const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
  const p = new Vector3();
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      at(i / cols, j / rows, p);
      pos.set([p.x, p.y, p.z], (j * (cols + 1) + i) * 3);
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
  g.setIndex(index);
  normals(g, cols, rows, closed);
  return g;
}

function normals(g: BufferGeometry, cols: number, rows: number, closed: boolean) {
  g.computeVertexNormals();
  if (!closed) return;
  // A seam that closes on itself shades as one surface.
  const n = g.getAttribute("normal") as BufferAttribute;
  const sum = new Vector3();
  for (let j = 0; j <= rows; j++) {
    const a = j * (cols + 1);
    const b = a + cols;
    sum.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, sum.x, sum.y, sum.z);
    n.setXYZ(b, sum.x, sum.y, sum.z);
  }
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
  g.computeVertexNormals();
  return g;
}

// Radius against height, hem to neck: a heavy cloak, wide where it pools.
const PROFILE = new SplineCurve(
  [
    [0.52, 0],
    [0.47, 0.16],
    [0.41, 0.48],
    [0.355, 0.84],
    [0.315, 1.1],
    [0.3, 1.27],
    [0.275, 1.39],
    [0.205, 1.465],
    [0.11, 1.505],
    [0.001, 1.525],
  ].map(([r, y]) => new Vector2(r, y)),
);

const BODY = { cols: 112, rows: 72 };

function body() {
  const { cols, rows } = BODY;
  const g = surface(
    cols,
    rows,
    (u, v, out) => {
      const { x: r0, y } = PROFILE.getPoint(v);
      const a = u * Math.PI * 2;
      // Folds fan out from the shoulders and deepen to the hem.
      const depth = 0.075 * (1 - v) ** 1.2 * smooth(0.93, 0.6, v);
      const folds = 0.55 * Math.sin(5 * a + 0.6 + v * 0.9) + 0.3 * Math.sin(9 * a + 2.1 - v * 1.4) + 0.15 * Math.sin(14 * a + 4 * v);
      const wrap = Math.atan2(Math.sin(a), Math.cos(a));
      // Where the cloak closes down the front, a shadowed overlap.
      const seam = 0.05 * Math.exp(-(wrap * wrap) / 0.01) * (1 - v);
      const r = r0 * (1 + depth * folds) * (1 - seam);
      // Broad across the shoulders, rounder at the hem; the back drags a little train.
      const squash = 0.64 + 0.22 * (1 - v);
      const train = 0.13 * (1 - v) ** 3 * Math.max(0, -Math.cos(a));
      out.set(r * Math.sin(a), y + (1 - v) ** 8 * 0.02 * Math.sin(7 * a), r * Math.cos(a) * squash - train);
    },
    true,
  );
  return outward(g, Math.round(rows / 2) * (BODY.cols + 1), 1);
}

const HOOD = { cols: 72, rows: 48 };
const HOOD_R = 0.19;

function hood() {
  const { cols, rows } = HOOD;
  const g = surface(
    cols,
    rows,
    (s, v, out) => {
      const phi = v * 2;
      // The opening: closed over the crown, a face wide from the brow, drawn in at the throat.
      const half = 0.02 + 0.42 * smooth(0.3, 0.9, phi) - 0.16 * smooth(1.35, 1.9, phi);
      const a = half + s * (Math.PI * 2 - 2 * half);
      const r = HOOD_R * (1 + 0.38 * smooth(1.15, 2, phi));
      const back = Math.max(0, -Math.cos(a));
      // The brim rolls forward a little round the opening; the crown peaks at the back.
      const lip = 0.035 * Math.exp(-Math.min(s, 1 - s) * 25) * smooth(0.2, 0.6, phi);
      const peak = 0.07 * back ** 1.5 * smooth(0.9, 0, phi);
      // Low down it widens and flattens to lie over the shoulders, the body's shape, not a shell's.
      const drape = smooth(1.3, 2, phi);
      out.set(
        r * Math.sin(phi) * Math.sin(a) * (1 + 0.2 * drape),
        HEAD_Y + r * Math.cos(phi) * 1.08 + peak * 0.5 - 0.1 * smooth(1.4, 2, phi),
        (r * Math.sin(phi) * Math.cos(a) * (Math.cos(a) > 0 ? 1.12 : 1) - 0.09 * back * back * smooth(0.15, 0.8, phi) + lip) * (1 - 0.28 * drape),
      );
    },
    false,
  );
  // Probed round the back, where an outward normal faces -z.
  return outward(g, Math.round(rows / 2) * (cols + 1) + cols / 2, -1);
}

// The hood slides back off the head and settles in folds on the shoulders.
// Seen from the front it's a silhouette, so the move is made for the outline:
// the cloth is drawn back and down behind the head and gathers towards the
// collar, which holds it. It never turns its opening up, so no edge of the
// brim ever stands proud of the head, and it never crosses the void.
const COLLAR = HEAD_Y - 0.21;

function slide(rest: Float32Array, out: BufferAttribute, k: number) {
  const p = new Vector3();
  const cols = HOOD.cols + 1;
  for (let i = 0; i < out.count; i++) {
    p.fromArray(rest, i * 3);
    const v = Math.floor(i / cols) / HOOD.rows;
    const u = (i % cols) / HOOD.cols;
    const w = (1 - smooth(0.55, 1, v)) * k;
    // Gathered: lower, narrower, further back, with folds where it bunches.
    const fold = 0.012 * Math.sin(u * Math.PI * 14 + v * 5) * Math.sin(Math.PI * w);
    out.setXYZ(
      i,
      p.x * (1 - 0.22 * w) + fold,
      COLLAR + (p.y - COLLAR) * (1 - 0.6 * w),
      p.z - 0.3 * w + fold * 0.6,
    );
  }
  out.needsUpdate = true;
}

// Shared by both materials; written once a frame.
const cloth = { uTime: { value: 0 }, uWalk: { value: 1 } };

function cloak() {
  const m = new MeshPhysicalMaterial({
    color: "#1a3426",
    roughness: 0.86,
    sheen: 0.6,
    sheenColor: "#2f5c43",
    sheenRoughness: 0.45,
    side: DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = cloth.uTime;
    shader.uniforms.uWalk = cloth.uWalk;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWalk;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vec3 root = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
  // The hem swings with each step: the knee pushes the front out on one side,
  // then the other, and the whole skirt trails a little behind the walk.
  float hem = clamp(1.0 - position.y / 1.15, 0.0, 1.0);
  hem *= hem;
  float step = root.z / ${STRIDE.toFixed(2)} * PI;
  float side = smoothstep(-0.14, 0.14, position.x);
  float knee = mix(max(0.0, sin(step)), max(0.0, -sin(step)), side);
  float front = smoothstep(-0.05, 0.25, position.z);
  transformed.z += hem * uWalk * (0.075 * knee * front - 0.035);
  transformed.x += hem * (uWalk * 0.018 * sin(step) + 0.008 * sin(uTime * 1.1 + root.x * 3.0 + position.y * 2.0));`,
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

/** The procession: the lead on their own (their hood slides back), the rest as one instanced mesh. */
export function Figures({ now }: Clocked) {
  const material = useMemo(() => cloak(), []);
  const parts = useMemo(() => {
    const h = hood();
    return { body: body(), hood: h, rest: Float32Array.from(h.getAttribute("position").array) };
  }, []);
  const whole = useMemo(() => {
    const g = mergeGeometries([parts.body.clone(), parts.hood.clone()]);
    if (!g) throw new Error("figure geometry failed to merge");
    return g;
  }, [parts]);
  const head = useMemo(() => {
    const g = new SphereGeometry(1, 32, 24);
    g.scale(0.11, 0.19, 0.12);
    g.translate(0, HEAD_Y - 0.06, 0);
    return g;
  }, []);
  const halo = useMemo(() => quad(), []);
  const haloMaterial = useMemo(() => voidMaterial(voidUniforms), []);

  const lead = useRef<Group>(null);
  const hoodMesh = useRef<Mesh>(null);
  const rest = useRef<InstancedMesh>(null);
  const voidMesh = useRef<Mesh>(null);
  const slid = useRef(0);
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

    const k = hoodSlide(t);
    const g = hoodMesh.current?.geometry;
    if (g && k !== slid.current) {
      slide(parts.rest, g.getAttribute("position") as BufferAttribute, k);
      normals(g, HOOD.cols, HOOD.rows, false);
      slid.current = k;
    }

    const open = voidOpen(t);
    voidUniforms.uTime.value = t;
    voidUniforms.uOpen.value = open;
    const m = voidMesh.current;
    if (m) {
      m.visible = open > 0;
      m.position.copy(VOID);
    }
  });

  return (
    <>
      <group ref={lead}>
        <mesh geometry={parts.body} material={material} castShadow />
        <mesh ref={hoodMesh} geometry={parts.hood} material={material} castShadow />
        <mesh geometry={head} material={black} />
      </group>
      <instancedMesh ref={rest} args={[whole, material, FIGURES - 1]} frustumCulled={false} castShadow />
      <mesh ref={voidMesh} geometry={halo} material={haloMaterial} frustumCulled={false} renderOrder={10} scale={[0.9, 1, 1]} />
    </>
  );
}
