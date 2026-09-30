import * as THREE from "three";

const NOISE = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}`;

/**
 * Open cone with its apex at the origin and its axis along +z, so
 * `mesh.lookAt(target)` aims it. Additive haze: brightest where the view
 * looks through the most of it, faded toward the tip, the far end and the floor.
 */
export function beam(length: number, angle: number) {
  const geometry = new THREE.ConeGeometry(Math.tan(angle) * length, length, 48, 1, true);
  geometry.translate(0, -length / 2, 0);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uLength: { value: length },
      uColor: { value: new THREE.Color(1, 0.88, 0.72) },
    },
    vertexShader: /* glsl */ `
      uniform float uLength;
      varying vec3 vWorld;
      varying vec3 vView;
      varying vec3 vNormal;
      varying float vAlong;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 view = viewMatrix * world;
        vWorld = world.xyz;
        vView = view.xyz;
        vNormal = normalize(normalMatrix * normal);
        vAlong = position.z / uLength;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vWorld;
      varying vec3 vView;
      varying vec3 vNormal;
      varying float vAlong;
      ${NOISE}
      void main() {
        float facing = pow(abs(dot(normalize(vNormal), normalize(-vView))), 2.4);
        float along = pow(1.0 - vAlong, 1.3) * smoothstep(0.0, 0.1, vAlong);
        float floorFade = smoothstep(0.0, 0.9, vWorld.y);
        float haze = 0.45 + 0.55 * noise(vWorld * 1.7 + vec3(0.0, -uTime * 0.22, uTime * 0.1));
        gl_FragColor = vec4(uColor * uIntensity * facing * along * floorFade * haze, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geometry, material);
}

/** Dust drifting up through the room; only the motes inside the cone show. */
export function motes(count: number, apex: THREE.Vector3, angle: number) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set([(Math.random() - 0.5) * 3.4, Math.random() * 3.6, (Math.random() - 0.4) * 3], i * 3);
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uPixel: { value: 1 },
      uApex: { value: apex.clone() },
      uAxis: { value: new THREE.Vector3(0, -1, 0) },
      uTan: { value: Math.tan(angle) },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uPixel;
      uniform vec3 uApex;
      uniform vec3 uAxis;
      uniform float uTan;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.05 + aSeed * 0.06), 3.6);
        p.x += sin(uTime * 0.5 + aSeed * 40.0) * 0.07;
        p.z += cos(uTime * 0.4 + aSeed * 23.0) * 0.07;
        vec3 d = p - uApex;
        float along = dot(d, uAxis);
        float inCone = 1.0 - smoothstep(0.55, 1.0, length(d - uAxis * along) / max(along * uTan, 0.001));
        float twinkle = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed * 2.5) + aSeed * 90.0);
        vAlpha = uIntensity * inCone * twinkle * smoothstep(0.0, 0.4, p.y) * smoothstep(3.6, 3.0, p.y);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPixel * (0.5 + aSeed) / -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.78) * a * vAlpha, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/**
 * A black room with softboxes, prefiltered for reflections. Built here rather
 * than loading an HDRI: nothing to fetch, and the strips carry the brand hues.
 */
export function studioEnvironment(gl: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x06070f);
  const box = (w: number, h: number, color: string, power: number, at: [number, number, number]) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }),
    );
    mesh.position.set(...at);
    mesh.lookAt(0, 1, 0);
    room.add(mesh);
  };
  box(5, 2.5, "#fff1e0", 5, [0, 7, 0.5]);
  box(1.2, 6, "#8fa2ff", 2.2, [-6, 2, 1.5]);
  box(1.2, 6, "#ffb0e4", 2.2, [6, 2, 1]);
  box(8, 0.6, "#ffd9a8", 1.4, [0, 3, -6]);
  box(7, 2.5, "#ffe2b8", 1.6, [0, 2, 7]);

  const pmrem = new THREE.PMREMGenerator(gl);
  const target = pmrem.fromScene(room, 0.03);
  pmrem.dispose();
  room.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return target;
}

// Tileable fractal value noise in [0, 1], size x size.
function noiseField(size: number, cells: number, octaves: number) {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = cells << o;
    const lattice = Float32Array.from({ length: n * n }, Math.random);
    const at = (x: number, y: number) => lattice[(y % n) * n + (x % n)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const sx = (fx - ix) ** 2 * (3 - 2 * (fx - ix));
        const sy = (fy - iy) ** 2 * (3 - 2 * (fy - iy));
        const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
        const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
        out[y * size + x] += amp * (top + (bottom - top) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  return out.map((v) => v / total);
}

function dataTexture(size: number, pixel: (i: number, rgba: Uint8Array) => void) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) pixel(i, data.subarray(i * 4, i * 4 + 4));
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Fine pile for the upholstery: a tangent-space normal map from noise. */
export function fabricNormals() {
  const size = 256;
  const h = noiseField(size, 32, 3);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  return dataTexture(size, (i, px) => {
    const x = i % size;
    const y = Math.floor(i / size);
    const dx = (at(x + 1, y) - at(x - 1, y)) * 6;
    const dy = (at(x, y + 1) - at(x, y - 1)) * 6;
    const len = Math.hypot(dx, dy, 1);
    px.set([((-dx / len) * 0.5 + 0.5) * 255, ((-dy / len) * 0.5 + 0.5) * 255, (0.5 / len + 0.5) * 255, 255]);
  });
}

/** Scuffed stage paint: roughness (green channel) from 0.35 to 0.85. */
export function floorRoughness() {
  const size = 256;
  const h = noiseField(size, 4, 5);
  return dataTexture(size, (i, px) => {
    const r = (0.35 + 0.5 * THREE.MathUtils.smoothstep(h[i], 0.3, 0.7)) * 255;
    px.set([r, r, r, 255]);
  });
}

/** Out-of-focus studio practicals far behind the stage. */
export function bokeh() {
  const lights: [number, number, number, string, number][] = [
    [-5.2, 3.2, -9, "#ffcf8a", 1],
    [-2.6, 2.2, -11, "#4d6bff", 0.7],
    [2.4, 3.6, -10, "#e83fd0", 0.8],
    [4.8, 2.1, -8.5, "#ffcf8a", 0.9],
    [7.2, 3.8, -10, "#7a2cff", 0.8],
    [-7.6, 1.4, -9.5, "#e83fd0", 0.6],
  ];
  const positions = new Float32Array(lights.length * 3);
  const colors = new Float32Array(lights.length * 3);
  const c = new THREE.Color();
  lights.forEach(([x, y, z, hex, power], i) => {
    positions.set([x, y, z], i * 3);
    c.set(hex).multiplyScalar(power).toArray(colors, i * 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { uPixel: { value: 1 }, uIntensity: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      uniform float uPixel;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uPixel / -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        // A lens disc: flat body, slightly brighter rim, soft edge.
        float disc = smoothstep(1.0, 0.7, r) * (0.7 + 0.3 * smoothstep(0.4, 0.85, r));
        gl_FragColor = vec4(vColor * disc * uIntensity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}
