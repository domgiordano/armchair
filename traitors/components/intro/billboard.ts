import { AdditiveBlending, InstancedBufferAttribute, PlaneGeometry, ShaderMaterial } from "three";

// Camera-facing quads drawn as one instanced mesh: flames, smoke, the void.
// Each instance's scale in its matrix is the quad's size; aSeed decorrelates them.

const VERTEX = /* glsl */ `
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 size = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  centre.xy += position.xy * size;
  // Our own falloff into the dark, as these skip three's fog.
  vFade = exp(-0.06 * max(-centre.z - 3.0, 0.0));
  gl_Position = projectionMatrix * centre;
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
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
`;

// Bright enough in the core (over 1) that Bloom picks it up and nothing else.
const FLAME = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
${NOISE}
void main() {
  float t = uTime + vSeed * 10.0;
  float y = vUv.y;
  float n = noise(vec2(vUv.x * 3.0 + vSeed * 7.0, y * 4.0 - t * 3.2));
  float n2 = noise(vec2(vUv.x * 7.0 - vSeed, y * 8.0 - t * 5.5));
  float x = (vUv.x - 0.5) + (n - 0.5) * 0.3 * y + sin(t * 2.3) * 0.035 * y;
  // A teardrop: widest a third of the way up, licking to a point.
  float w = 0.5 * (1.0 - y) * sqrt(max(y, 1e-4));
  float d = abs(x) / max(w, 1e-4);
  float body = smoothstep(1.0, 0.4, d + (n2 - 0.5) * 0.4) * smoothstep(0.0, 0.06, y) * smoothstep(0.95, 0.55, y + (n - 0.5) * 0.35);
  float core = smoothstep(0.6, 0.0, d) * smoothstep(0.6, 0.08, y);
  vec3 col = mix(vec3(0.9, 0.22, 0.04), vec3(1.0, 0.6, 0.18), body);
  col = mix(col, vec3(1.0, 0.9, 0.66), core);
  float glow = exp(-7.0 * length(vec2(x * 1.6, y - 0.28))) * 0.18;
  gl_FragColor = vec4(col * (body * (1.5 + core * 2.2) + glow) * vFade, 1.0);
}
`;

// Thin smoke under the vaults, lit warm from below.
const SMOKE = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
${NOISE}
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float n = fbm(vUv * 2.2 + vec2(uTime * 0.04 + vSeed * 3.0, -uTime * 0.07));
  float a = smoothstep(1.0, 0.15, r) * smoothstep(0.32, 0.75, n) * uOpacity * (0.4 + 0.6 * vFade);
  gl_FragColor = vec4(vec3(0.24, 0.17, 0.11) * (0.7 + 0.5 * vUv.y), a);
}
`;

// Darkness pouring out from where a face would be: black, with a ragged edge.
const VOID = /* glsl */ `
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
varying float vSeed;
varying float vFade;
${NOISE}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float n = fbm(p * 2.5 + vec2(uTime * 0.15, -uTime * 0.3));
  float edge = uOpen * 0.8;
  // Ragged inside, but always gone well before the quad's edge.
  float a = smoothstep(edge, edge * 0.55, r + (n - 0.5) * 0.35 * uOpen) * smoothstep(0.98, 0.8, r);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

export function quad(lift = 0) {
  const g = new PlaneGeometry(1, 1);
  g.translate(0, lift, 0);
  return g;
}

export function seeds(count: number) {
  return new InstancedBufferAttribute(Float32Array.from({ length: count }, (_, i) => (i * 0.618) % 1), 1);
}

type Uniforms = Record<string, { value: number }>;

export const flameMaterial = (uniforms: Uniforms) =>
  new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FLAME,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

export const smokeMaterial = (uniforms: Uniforms) =>
  new ShaderMaterial({ vertexShader: VERTEX, fragmentShader: SMOKE, uniforms, transparent: true, depthWrite: false });

export const voidMaterial = (uniforms: Uniforms) =>
  new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: VOID,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
