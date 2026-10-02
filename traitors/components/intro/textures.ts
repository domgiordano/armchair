import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";

import floorArm from "./stone/floor-arm.webp";
import floorColor from "./stone/floor-color.webp";
import floorNormal from "./stone/floor-normal.webp";
import wallColor from "./stone/wall-color.webp";
import wallNormal from "./stone/wall-normal.webp";

// Photographed CC0 stone from Poly Haven (see traitors/ASSETS.md), imported so
// each file gets a hashed URL, plus two textures painted here at load: our
// own tartan and a tiling noise the fog and smoke shaders sample.

export interface Stone {
  map: Texture;
  normalMap: Texture;
  /** Ambient occlusion, roughness, metalness in r, g, b. */
  arm?: Texture;
}

export interface Surfaces {
  wall: Stone;
  floor: Stone;
}

const loader = new TextureLoader();

async function load(src: string, color: boolean) {
  const t = await loader.loadAsync(src);
  t.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Every stone texture, downloaded and decoded. */
export async function loadSurfaces(): Promise<Surfaces> {
  const [wm, wn, fm, fn, fa] = await Promise.all([
    load(wallColor.src, true),
    load(wallNormal.src, false),
    load(floorColor.src, true),
    load(floorNormal.src, false),
    load(floorArm.src, false),
  ]);
  return { wall: { map: wm, normalMap: wn }, floor: { map: fm, normalMap: fn, arm: fa } };
}

/** A copy of a stone that tiles at its own scale; the image is shared, not uploaded twice. */
export function tiled(s: Stone, x: number, y: number): Stone {
  const each = (t: Texture) => {
    const c = t.clone();
    c.repeat.set(x, y);
    return c;
  };
  return { map: each(s.map), normalMap: each(s.normalMap), arm: s.arm && each(s.arm) };
}

/**
 * Our own sett, not a registered one: a cloak-green ground, an oxblood
 * overcheck, a navy band, thin gilt and bone lines. The same colours as the
 * landing's tartan bands.
 */
export function tartan(): CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas for the intro's tartan");
  ctx.fillStyle = "#1e4a33";
  ctx.fillRect(0, 0, S, S);
  // [offset, width, colour] across one 256 px repeat, mirrored in the other axis.
  const bands: [number, number, string][] = [
    [0, 64, "rgb(74 14 22 / 0.85)"],
    [96, 36, "rgb(28 42 68 / 0.8)"],
    [150, 10, "rgb(179 34 46 / 0.75)"],
    [176, 40, "rgb(10 13 11 / 0.6)"],
    [80, 3, "rgb(199 154 58 / 0.9)"],
    [232, 2, "rgb(244 236 218 / 0.65)"],
  ];
  for (const [o, w, color] of bands) {
    ctx.fillStyle = color;
    ctx.fillRect(o, 0, w, S);
    ctx.fillRect(0, o, S, w);
  }
  // The twill: fine diagonal lines, so it reads as cloth.
  ctx.strokeStyle = "rgb(0 0 0 / 0.18)";
  ctx.lineWidth = 1;
  for (let i = -S; i < S; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + S, S);
    ctx.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(2, 4);
  t.anisotropy = 8;
  return t;
}

/**
 * Tiling fractal noise, four unrelated fields in r, g, b and a. Sampling this
 * costs the fog one texture read where computing it would cost dozens, and the
 * fog is drawn over most of the screen many times over.
 */
export function noise(): DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  for (let ch = 0; ch < 4; ch++) {
    const lattice = Array.from({ length: 6 }, (_, o) => {
      const cells = 4 << o;
      let s = 1 + ch * 977 + o * 131;
      return {
        cells,
        v: Float32Array.from({ length: cells * cells }, () => {
          s = (s * 16807) % 2147483647;
          return s / 2147483647;
        }),
      };
    });
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let sum = 0;
        let amp = 0.5;
        let norm = 0;
        for (const { cells, v } of lattice) {
          const fx = (x / N) * cells;
          const fy = (y / N) * cells;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          const ux = (fx - ix) ** 2 * (3 - 2 * (fx - ix));
          const uy = (fy - iy) ** 2 * (3 - 2 * (fy - iy));
          const at = (i: number, j: number) => v[((j + cells) % cells) * cells + ((i + cells) % cells)];
          const top = at(ix, iy) * (1 - ux) + at(ix + 1, iy) * ux;
          const bottom = at(ix, iy + 1) * (1 - ux) + at(ix + 1, iy + 1) * ux;
          sum += amp * (top * (1 - uy) + bottom * uy);
          norm += amp;
          amp *= 0.5;
        }
        data[(y * N + x) * 4 + ch] = Math.round((sum / norm) * 255);
      }
    }
  }
  const t = new DataTexture(data, N, N, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
