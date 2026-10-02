import { AdditiveBlending, type IUniform, InstancedBufferAttribute, PlaneGeometry, ShaderMaterial, type Vector3 } from "three";

import { FIRE, HALL, TORCHES } from "./timeline";

// The scene's light-made things, each a shader on a plain quad: flames, the
// fire beyond the door, the fog that carries its light, embers, and the void.
// Every one is a pure function of uTime, like the rest of the scene.

// Upright billboards: turned to face the camera about the vertical only, so a
// flame stays upright when the camera tilts. Size comes from the matrix's scale.
const UPRIGHT = /* glsl */ `
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
varying float vDepth;
void main() {
  vUv = uv;
  vSeed = aSeed;
#ifdef USE_INSTANCING
  mat4 m = modelMatrix * instanceMatrix;
#else
  mat4 m = modelMatrix;
#endif
  vec3 centre = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 size = vec2(length(m[0].xyz), length(m[1].xyz));
  vec3 toCam = cameraPosition - centre;
  vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));
  vec3 world = centre + right * position.x * size.x + vec3(0.0, 1.0, 0.0) * position.y * size.y;
  vec4 view = viewMatrix * vec4(world, 1.0);
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

// World-placed quads: fog sheets across the hall, the fire beyond the door.
const PLACED = /* glsl */ `
#ifdef USE_INSTANCING
attribute float aSeed;
#endif
varying vec2 vUv;
varying vec3 vWorld;
varying float vSeed;
void main() {
  vUv = uv;
#ifdef USE_INSTANCING
  vSeed = aSeed;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
#else
  vSeed = 0.0;
  vec4 world = modelMatrix * vec4(position, 1.0);
#endif
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
`;

// Fire as temperature: a turbulent field rising through a teardrop, mapped
// through a blackbody ramp. White-yellow at the root, orange, then deep red
// tongues that tear off at the top. Over 1 in the core, so Bloom takes it.
const FIRE_RAMP = /* glsl */ `
vec3 blackbody(float k) {
  vec3 c = mix(vec3(0.45, 0.04, 0.0), vec3(1.0, 0.32, 0.04), smoothstep(0.05, 0.4, k));
  c = mix(c, vec3(1.0, 0.68, 0.26), smoothstep(0.4, 0.7, k));
  return mix(c, vec3(1.0, 0.93, 0.78), smoothstep(0.75, 1.0, k));
}
`;

const FLAME = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vDepth;
${NOISE}
${FIRE_RAMP}
void main() {
  float t = uTime + vSeed * 17.0;
  vec2 uv = vUv;
  float rise = t * 2.6;
  float n = fbm(vec2(uv.x * 2.6 + vSeed * 5.0, uv.y * 2.2 - rise));
  float n2 = fbm(vec2(uv.x * 5.0 - vSeed * 3.0, uv.y * 4.4 - rise * 1.35));
  float y = uv.y;
  float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 1.1 * y + sin(t * 1.9 + y * 3.0) * 0.08 * y;
  // Widest a quarter of the way up, drawn to a point; the tongues above tear free.
  float w = 0.62 * sqrt(max(y * 1.6, 1e-4)) * max(1.0 - y, 0.0);
  float body = 1.0 - abs(x) / max(w, 1e-3);
  float heat = body * (1.15 - y) + (n2 - 0.5) * 0.7;
  float tear = smoothstep(0.1, 0.45, n2 + 0.55 - y * 0.95);
  heat *= tear * smoothstep(0.0, 0.07, y);
  float k = clamp(heat, 0.0, 1.0);
  float a = smoothstep(0.03, 0.3, heat);
  vec3 col = blackbody(k) * a * (0.9 + 3.2 * k * k);
  // A faint warm halo round the flame, gone well before the quad's edge.
  vec2 c = vec2((uv.x - 0.5) * 1.6, y - 0.28);
  col += vec3(1.0, 0.45, 0.12) * 0.12 * exp(-7.0 * length(c)) * smoothstep(0.98, 0.7, length(c) * 1.4);
  gl_FragColor = vec4(col, 1.0);
}
`;

// The fire beyond the door: a wall of light with a hearth's flames along its
// foot, and smoke rolling through the top. The door frames it.
const BEYOND = /* glsl */ `
uniform float uTime;
uniform float uGlow;
varying vec2 vUv;
varying vec3 vWorld;
varying float vSeed;
${NOISE}
${FIRE_RAMP}
void main() {
  vec2 p = vWorld.xy;
  float t = uTime;
  float floorGlow = exp(-max(p.y - ${FIRE.y.toFixed(2)}, 0.0) * 0.55) * exp(-p.x * p.x * 0.12);
  float tongues = fbm(vec2(p.x * 1.4, p.y * 1.1 - t * 1.6));
  float heat = clamp(floorGlow * (0.55 + 0.9 * tongues) - 0.1, 0.0, 1.0);
  vec3 col = blackbody(heat * 0.95) * (0.45 + 1.7 * heat);
  float smoke = fbm(vec2(p.x * 0.5 + t * 0.12, p.y * 0.6 - t * 0.25));
  col *= mix(1.0, 0.55, smoothstep(0.45, 0.75, smoke) * smoothstep(1.5, 4.0, p.y));
  gl_FragColor = vec4(col * uGlow, 1.0);
}
`;

// Fog sheets hung across the hall. Each takes light from the door (strongest
// down the middle and low, where the fire is) and from the torches near it.
// Additive and depth-tested: whatever stands behind a sheet stays dark, and
// whatever stands in front of one sits in its light, which is what makes the
// figures read as silhouettes in smoke.
const torchList = TORCHES.map((v) => `vec3(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`).join(", ");
const FOG = /* glsl */ `
uniform float uTime;
uniform float uGlow;
uniform float uTorch;
uniform float uDensity;
uniform sampler2D uNoise;
varying vec2 vUv;
varying vec3 vWorld;
varying float vSeed;
const vec3 TORCH[4] = vec3[4](${torchList});
void main() {
  vec3 p = vWorld;
  float t = uTime;
  vec2 drift = vec2(t * 0.03 + vSeed * 0.37, -t * 0.018);
  vec2 q = p.xy * vec2(0.085, 0.12);
  float warp = texture2D(uNoise, q * 0.7 - drift * 0.6).g;
  float n = texture2D(uNoise, q + drift + vec2(0.0, warp * 0.3)).r * 0.65 + texture2D(uNoise, q * 2.7 + drift * 1.8).b * 0.35;
  // Heavier on the floor, thin up in the vault.
  float density = smoothstep(0.38, 0.68, n) * (0.35 + 0.9 * exp(-max(p.y, 0.0) * 0.7));
  float edge = smoothstep(${HALL.halfWidth.toFixed(2)}, ${(HALL.halfWidth - 0.9).toFixed(2)}, abs(p.x)) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
  float door = exp(-abs(p.z - ${HALL.door.toFixed(2)}) * 0.13) * exp(-p.x * p.x * 0.16 - (p.y - 1.4) * (p.y - 1.4) * 0.08);
  float torch = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 d = p - TORCH[i];
    torch += exp(-dot(d, d) * 0.9);
  }
  vec3 light = vec3(1.0, 0.56, 0.24) * door * uGlow * 1.7 + vec3(1.0, 0.5, 0.18) * torch * uTorch;
  gl_FragColor = vec4(light * density * edge * uDensity, 1.0);
}
`;

// Embers, born over the fires and carried up and towards the camera on the
// draught. Each instance loops on its own life, so any t poses them.
const EMBER = /* glsl */ `
uniform float uTime;
attribute float aSeed;
attribute vec3 aBase;
varying float vGlow;
varying vec2 vUv;
float h(float n) { return fract(sin(n * 91.345) * 47453.21); }
void main() {
  vUv = uv;
  float life = 2.6 + h(aSeed) * 2.4;
  float age = mod(uTime + h(aSeed + 1.0) * life, life) / life;
  vec3 p = aBase;
  p.y += age * (1.4 + h(aSeed + 2.0) * 1.6);
  p.z += age * (0.6 + h(aSeed + 3.0) * 1.2);
  p.x += sin(uTime * (1.3 + h(aSeed + 4.0)) + aSeed * 6.0) * 0.18 * age;
  vGlow = smoothstep(0.0, 0.12, age) * smoothstep(1.0, 0.55, age) * (0.6 + 0.8 * h(aSeed + 5.0)) * (0.7 + 0.3 * sin(uTime * 17.0 + aSeed * 9.0));
  vec4 view = viewMatrix * vec4(p, 1.0);
  float size = 0.006 + 0.008 * h(aSeed + 6.0);
  view.xy += position.xy * size;
  gl_Position = projectionMatrix * view;
}
`;

const EMBER_FRAG = /* glsl */ `
varying float vGlow;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, r);
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.16) * a * a * vGlow * 3.0, 1.0);
}
`;

// Darkness where a face would be: black, with a ragged smoking edge that
// spreads as the hood leaves the head. Opaque at the centre, always.
const VOID = /* glsl */ `
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.y *= 1.0 - 0.25 * smoothstep(0.0, 1.0, p.y);
  float r = length(p);
  float n = fbm(p * 2.2 + vec2(uTime * 0.12, -uTime * 0.38));
  float n2 = fbm(p * 4.0 + vec2(-uTime * 0.2, -uTime * 0.6));
  float edge = mix(0.4, 0.8, uOpen);
  float a = smoothstep(edge, edge * 0.55, r + (n - 0.5) * 0.28 * uOpen + (n2 - 0.5) * 0.08);
  a *= smoothstep(1.0, 0.82, r);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * smoothstep(0.0, 0.08, uOpen));
}
`;

export function quad(lift = 0) {
  const g = new PlaneGeometry(1, 1);
  g.translate(0, lift, 0);
  return g;
}

export function seeds(count: number) {
  return new InstancedBufferAttribute(Float32Array.from({ length: count }, (_, i) => (i * 0.618 + 0.13) % 1), 1);
}

/** One base point per ember, spread round each source. */
export function emberBases(sources: Vector3[], perSource: number, spread: [number, number, number]) {
  const out = new Float32Array(sources.length * perSource * 3);
  let s = 7;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
  sources.forEach((v, i) => {
    for (let j = 0; j < perSource; j++) {
      out.set([v.x + r() * spread[0], v.y + r() * spread[1], v.z + r() * spread[2]], (i * perSource + j) * 3);
    }
  });
  return new InstancedBufferAttribute(out, 3);
}

type Uniforms = Record<string, IUniform>;

const additive = { transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false } as const;

export const flameMaterial = (uniforms: Uniforms) =>
  new ShaderMaterial({ vertexShader: UPRIGHT, fragmentShader: FLAME, uniforms, ...additive });

export const beyondMaterial = (uniforms: Uniforms) =>
  new ShaderMaterial({ vertexShader: PLACED, fragmentShader: BEYOND, uniforms, fog: false });

export const fogMaterial = (uniforms: Uniforms) => new ShaderMaterial({ vertexShader: PLACED, fragmentShader: FOG, uniforms, ...additive });

export const emberMaterial = (uniforms: Uniforms) =>
  new ShaderMaterial({ vertexShader: EMBER, fragmentShader: EMBER_FRAG, uniforms, ...additive });

export const voidMaterial = (uniforms: Uniforms) =>
  new ShaderMaterial({
    vertexShader: UPRIGHT,
    fragmentShader: VOID,
    uniforms,
    transparent: true,
    depthWrite: false,
    // Over the hood as well as the head: the cloth slides back inside the dark, never in front of it.
    depthTest: false,
  });
