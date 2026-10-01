/** Where the square crop sits in the source image, in source pixels. */
export interface Square {
  x: number;
  y: number;
  size: number;
}

export const OUTPUT_SIZE = 512;
export const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * The square at `zoom` (1 = the largest square that fits) centred as near
 * (cx, cy) as the image edges allow.
 */
export function square(width: number, height: number, zoom: number, cx: number, cy: number): Square {
  const size = Math.min(width, height) / clamp(zoom, 1, MAX_ZOOM);
  return {
    x: clamp(cx - size / 2, 0, width - size),
    y: clamp(cy - size / 2, 0, height - size),
    size,
  };
}

/** The crop as a JPEG, OUTPUT_SIZE on a side. */
export function renderSquare(image: CanvasImageSource, crop: Square): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("This browser can't edit photos"));
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the photo"))),
      "image/jpeg",
      0.9,
    ),
  );
}
