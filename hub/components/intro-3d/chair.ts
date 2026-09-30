import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// Chair space: floor at y = 0, seat front toward +z, about 1.9 wide.
export const BACK_TILT = -0.1;
export const CROWN_REST = new THREE.Vector3(0, 1.8, -0.43);
export const PADDLE_HINGE = new THREE.Vector3(0, 0.83, -0.12);
export const PADDLE_SIZE = { w: 0.8, h: 0.7 };

// The logo's body gradient runs bottom-left blue to top-right orange.
const STOPS: [number, THREE.Color][] = [
  [0, new THREE.Color("#2f4dff")],
  [0.36, new THREE.Color("#7a2cff")],
  [0.66, new THREE.Color("#e83fd0")],
  [1, new THREE.Color("#ffa23d")],
];

function gradientAt(s: number, out: THREE.Color) {
  const t = THREE.MathUtils.clamp(s, 0, 1);
  const i = STOPS.findIndex(([at]) => at >= t);
  if (i <= 0) return out.copy(STOPS[0][1]);
  const [a, ca] = STOPS[i - 1];
  const [b, cb] = STOPS[i];
  return out.copy(ca).lerp(cb, (t - a) / (b - a));
}

// A superellipsoid: a sphere pushed toward a box. Unlike RoundedBox it has
// vertices across every face, so the faces bulge like stuffed upholstery.
function cushion(w: number, h: number, d: number, e: number) {
  const g = new THREE.SphereGeometry(1, 40, 28);
  const p = g.attributes.position;
  const f = (v: number, half: number) => Math.sign(v) * Math.abs(v) ** e * half;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, f(p.getX(i), w / 2), f(p.getY(i), h / 2), f(p.getZ(i), d / 2));
  }
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const merged = mergeVertices(g);
  merged.computeVertexNormals();
  return merged;
}

// Welt cord around a cushion's widest seam, in the xz plane.
function piping(w: number, d: number, e: number) {
  const points = Array.from({ length: 96 }, (_, k) => {
    const a = (k / 96) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return new THREE.Vector3(Math.sign(c) * Math.abs(c) ** e * (w / 2 + 0.004), 0, Math.sign(s) * Math.abs(s) ** e * (d / 2 + 0.004));
  });
  return bare(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 192, 0.016, 6, true));
}

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, rz = 0) {
  g.rotateX(rx);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

function bare(g: THREE.BufferGeometry) {
  g.deleteAttribute("uv");
  return g;
}

export function chairGeometry() {
  const parts: THREE.BufferGeometry[] = [
    place(cushion(1.9, 0.36, 0.98, 0.34), 0, 0.4, 0),
    place(cushion(1.1, 0.34, 0.86, 0.5), 0, 0.66, 0.1),
    place(cushion(1.62, 1.3, 0.4, 0.46), 0, 1.18, -0.36, BACK_TILT),
    place(piping(1.9, 0.98, 0.34), 0, 0.4, 0),
    place(piping(1.1, 0.86, 0.5), 0, 0.66, 0.1),
    place(piping(1.62, 1.3, 0.46).rotateX(Math.PI / 2), 0, 1.18, -0.36, BACK_TILT),
  ];

  for (const side of [-1, 1]) {
    parts.push(place(cushion(0.46, 0.72, 0.94, 0.4), side * 0.8, 0.74, 0.04));
    // The rolled scroll arm: its round end is what reads as "armchair".
    parts.push(place(bare(new THREE.CapsuleGeometry(0.25, 0.6, 8, 28)), side * 0.84, 1.1, 0.08, Math.PI / 2));
    parts.push(place(bare(new THREE.TorusGeometry(0.25, 0.016, 6, 64)), side * 0.84, 1.1, 0.38));
    for (const z of [-0.36, 0.36]) {
      const leg = bare(new THREE.CylinderGeometry(0.055, 0.032, 0.26, 16));
      parts.push(place(leg, side * 0.72, 0.13, z, z > 0 ? -0.18 : 0.18, side * 0.22));
    }
  }

  const merged = mergeGeometries(parts);
  const pos = merged.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  // Only for the fabric grain, which is fine enough that a skewed planar
  // projection shows no stretch, and it leaves no seams.
  const uvs = new Float32Array(pos.count * 2);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    gradientAt((x * 0.8 + (y - 0.9) * 0.5) / 1.8 + 0.5, c).toArray(colors, i * 3);
    uvs.set([(x + z * 0.8) * 6, (y + z * 0.35) * 6], i * 2);
  }
  merged.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return merged;
}

export function paddleGeometry() {
  return place(cushion(PADDLE_SIZE.w, PADDLE_SIZE.h, 0.05, 0.16), 0, PADDLE_SIZE.h / 2, 0);
}

export function crownGeometry() {
  const r = 0.3;
  const band = 0.12;
  const spike = 0.24;
  const points = 5;
  const shell = new THREE.CylinderGeometry(r, r * 0.9, 1, 80, 1, true);
  const p = shell.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0) {
      p.setY(i, 0);
      continue;
    }
    // Triangle wave around the rim, one peak facing the camera.
    const a = Math.atan2(p.getX(i), p.getZ(i)) / (Math.PI * 2) + 0.5;
    const tri = 1 - Math.abs(((a * points) % 1) * 2 - 1);
    p.setY(i, band + spike * tri);
  }
  shell.computeVertexNormals();

  const parts: THREE.BufferGeometry[] = [bare(shell), bare(place(new THREE.TorusGeometry(r * 0.93, 0.022, 10, 64), 0, 0.012, 0, Math.PI / 2))];
  for (let k = 0; k < points; k++) {
    const a = ((k + 0.5) / points - 0.5) * Math.PI * 2;
    parts.push(bare(place(new THREE.SphereGeometry(0.03, 12, 8), Math.sin(a) * r * 0.96, band + spike + 0.02, Math.cos(a) * r * 0.96)));
  }
  return mergeGeometries(parts);
}
