"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { MAX_ZOOM, renderSquare, square } from "@/lib/crop";

import { FOCUS, PRIMARY, SECONDARY, Skeleton } from "./ui";

interface AvatarCropperProps {
  file: File;
  onCancel: () => void;
  // Rejects with a message to show; the cropper stays open to try again.
  onCropped: (photo: Blob) => Promise<void>;
}

type Source = { kind: "loading" } | { kind: "ready"; image: HTMLImageElement; url: string } | { kind: "error" };

/** Drag or arrow keys to frame, the slider to zoom. Emits a 512px square JPEG. */
export function AvatarCropper({ file, onCancel, onCropped }: AvatarCropperProps) {
  const [source, setSource] = useState<Source>({ kind: "loading" });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      setCenter({ x: image.naturalWidth / 2, y: image.naturalHeight / 2 });
      setSource({ kind: "ready", image, url });
    };
    image.onerror = () => setSource({ kind: "error" });
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (source.kind === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>That file isn&apos;t a photo this browser can open. Try a JPEG or PNG.</p>
        <button type="button" onClick={onCancel} className={SECONDARY}>
          Back
        </button>
      </div>
    );
  }
  if (source.kind === "loading" || center === null) {
    return (
      <div role="status" className="flex flex-col items-center gap-4">
        <span className="sr-only">Opening the photo...</span>
        <Skeleton className="aspect-square w-full max-w-72 rounded-xl" />
      </div>
    );
  }

  const { image, url } = source;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const crop = square(w, h, zoom, center.x, center.y);
  const moveTo = (cx: number, cy: number, z = zoom) => {
    const next = square(w, h, z, cx, cy);
    setCenter({ x: next.x + next.size / 2, y: next.y + next.size / 2 });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, cx: center.x, cy: center.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!start || !box) return;
    // Screen pixels to source pixels: the frame shows crop.size across its width.
    const scale = crop.size / box.width;
    moveTo(start.cx - (e.clientX - start.px) * scale, start.cy - (e.clientY - start.py) * scale);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = crop.size * 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key in moves) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      moveTo(center.x + dx, center.y + dy);
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      const z = Math.min(MAX_ZOOM, Math.max(1, zoom + (e.key === "-" ? -0.1 : 0.1)));
      setZoom(z);
      moveTo(center.x, center.y, z);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCropped(await renderSquare(image, crop));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the photo");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p id="crop-hint" className="self-start text-sm text-muted">
        Drag to frame your face. Arrow keys move it, plus and minus zoom.
      </p>
      <div
        ref={frame}
        role="group"
        aria-label="Photo framing"
        aria-describedby="crop-hint"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="relative aspect-square w-full max-w-72 cursor-grab touch-none overflow-hidden rounded-xl bg-night select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
        <img
          src={url}
          alt=""
          width={w}
          height={h}
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            width: `${(w / crop.size) * 100}%`,
            height: "auto",
            left: `${(-crop.x / crop.size) * 100}%`,
            top: `${(-crop.y / crop.size) * 100}%`,
          }}
        />
        {/* The circle the avatar shows; outside it is dimmed, not cut, so you can see what's lost. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(2_8_30/0.62)] ring-2 ring-text/80"
        />
      </div>
      <label className="flex w-full max-w-72 flex-col gap-1 text-sm text-muted">
        Zoom
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            const z = Number(e.target.value);
            setZoom(z);
            moveTo(center.x, center.y, z);
          }}
          className={`h-11 rounded-full accent-gold ${FOCUS}`}
        />
      </label>
      {error !== null && (
        <p role="alert" className="self-start text-sm text-magenta">
          {error}
        </p>
      )}
      <div className="flex w-full justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={SECONDARY}>
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} className={PRIMARY}>
          {busy ? "Saving..." : "Use this photo"}
        </button>
      </div>
    </div>
  );
}
