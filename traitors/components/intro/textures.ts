import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";

// Every surface is painted here at load, from a seed, so there's nothing to
// download and every visit paints the same castle (the poster depends on it).

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas for the intro's textures");
  return { c, ctx };
}

function texture(c: HTMLCanvasElement, color: boolean, repeat: [number, number]) {
  const t = new CanvasTexture(c);
  t.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/** Grain over a whole canvas, light or dark, so no block is a flat fill. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgb(${v} ${v} ${v} / ${alpha * rand()})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

export interface Surface {
  map: CanvasTexture;
  bump: CanvasTexture;
}

/** Coursed rubble stone: rows of uneven blocks in a dark mortar. */
export function stone(seed: number, repeat: [number, number], rows = 8): Surface {
  const rand = seeded(seed);
  const W = 1024;
  const H = 512;
  const col = canvas(W, H);
  const bmp = canvas(W, H);
  col.ctx.fillStyle = "#17140f";
  col.ctx.fillRect(0, 0, W, H);
  bmp.ctx.fillStyle = "#000";
  bmp.ctx.fillRect(0, 0, W, H);
  const rowH = H / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 120;
    while (x < W) {
      const w = 90 + rand() * 130;
      const inset = 3 + rand() * 3;
      const tone = 52 + rand() * 34;
      const warm = rand() * 10;
      for (const [dx] of [[0], [W], [-W]]) {
        const bx = x + dx + inset;
        const by = r * rowH + inset;
        const bw = w - inset * 2;
        const bh = rowH - inset * 2;
        if (bx > W || bx + bw < 0) continue;
        col.ctx.fillStyle = `rgb(${tone + warm} ${tone + warm * 0.6} ${tone - 6})`;
        roundRect(col.ctx, bx, by, bw, bh, 6 + rand() * 6);
        // Bump: proud of the mortar, a little domed.
        const g = bmp.ctx.createRadialGradient(bx + bw / 2, by + bh / 2, 2, bx + bw / 2, by + bh / 2, Math.max(bw, bh) * 0.7);
        g.addColorStop(0, "#d8d8d8");
        g.addColorStop(1, "#8a8a8a");
        bmp.ctx.fillStyle = g;
        roundRect(bmp.ctx, bx, by, bw, bh, 6);
      }
      x += w;
    }
  }
  grain(col.ctx, W, H, rand, 26000, 0.16);
  grain(bmp.ctx, W, H, rand, 26000, 0.35);
  // Soot and damp, in broad patches.
  for (let i = 0; i < 40; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 40 + rand() * 140;
    const g = col.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgb(0 0 0 / ${0.12 + rand() * 0.2})`);
    g.addColorStop(1, "rgb(0 0 0 / 0)");
    col.ctx.fillStyle = g;
    col.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return { map: texture(col.c, true, repeat), bump: texture(bmp.c, false, repeat) };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Dark stained oak, grain running along u. */
export function wood(seed: number, repeat: [number, number]): Surface {
  const rand = seeded(seed);
  const W = 512;
  const H = 512;
  const col = canvas(W, H);
  const bmp = canvas(W, H);
  col.ctx.fillStyle = "#2a160c";
  col.ctx.fillRect(0, 0, W, H);
  bmp.ctx.fillStyle = "#808080";
  bmp.ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const y = rand() * H;
    const tone = rand();
    col.ctx.strokeStyle = tone < 0.5 ? `rgb(14 7 3 / ${0.3 + rand() * 0.4})` : `rgb(70 40 20 / ${0.15 + rand() * 0.25})`;
    bmp.ctx.strokeStyle = tone < 0.5 ? "rgb(40 40 40 / 0.5)" : "rgb(170 170 170 / 0.4)";
    col.ctx.lineWidth = bmp.ctx.lineWidth = 0.6 + rand() * 2.2;
    const amp = 2 + rand() * 6;
    const freq = 0.004 + rand() * 0.01;
    const ph = rand() * 6;
    for (const ctx of [col.ctx, bmp.ctx]) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + Math.sin(x * freq + ph) * amp);
      ctx.stroke();
    }
  }
  // Plank seams.
  for (let y = 0; y < H; y += H / 4) {
    col.ctx.fillStyle = "rgb(8 4 2 / 0.9)";
    col.ctx.fillRect(0, y, W, 3);
    bmp.ctx.fillStyle = "#202020";
    bmp.ctx.fillRect(0, y, W, 3);
  }
  grain(col.ctx, W, H, rand, 8000, 0.1);
  return { map: texture(col.c, true, repeat), bump: texture(bmp.c, false, repeat) };
}

/**
 * Our own sett, not a registered one: a cloak-green ground, an oxblood
 * overcheck, a navy band, thin gilt and bone lines. The same colours as the
 * landing's tartan bands.
 */
export function tartan(): CanvasTexture {
  const S = 256;
  const { c, ctx } = canvas(S, S);
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
  return texture(c, true, [2, 3]);
}
