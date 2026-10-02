"use client";

import Image from "next/image";
import { useId, useState } from "react";

import type { Exit } from "@/lib/api/traitors";
import { cn } from "@/lib/ui";

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => Array.from(w)[0]).join("").toUpperCase() || "?";
}

/** Out of the game, so crossed off the wall. A winner or finalist left on top. */
export const eliminated = (exit: Exit | null | undefined) => Boolean(exit && !/winner|runner|final/i.test(exit.how));

interface PortraitProps {
  name: string;
  src: string | null;
  size: number;
  shape: "frame" | "round";
  /** No photo: a player gets a hooded figure, one of us plain initials. */
  fallback: "hood" | "initials";
  className?: string;
}

function Portrait({ name, src, size, shape, fallback, className }: PortraitProps) {
  // Keyed by URL so a new picture gets a fresh try after an old one failed.
  const [failed, setFailed] = useState<string | null>(null);
  const box = cn("shrink-0", shape === "frame" ? "rounded-sm ring-1 ring-gilt/70" : "rounded-full", className);

  if (src && failed !== src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        // Google's photo host refuses some requests that carry a Referer.
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        style={{ width: size, height: size }}
        className={cn(box, "bg-cloak object-cover")}
      />
    );
  }
  if (fallback === "hood") {
    return (
      <span role="img" aria-label={name} style={{ width: size, height: size }} className={cn(box, "inline-block overflow-hidden align-top")}>
        <HoodedFigure letters={initials(name)} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cn(box, "flex items-center justify-center bg-cloak-500 font-display font-semibold text-bone", shape === "round" && "ring-1 ring-gilt/60")}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}

/** A cloaked figure with an empty hood, the initials stitched on the chest. Never a face. */
function HoodedFigure({ letters }: { letters: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 60 60" aria-hidden="true" className="block size-full">
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor="var(--cloak-500)" stopOpacity={0.55} />
          <stop offset="100%" stopColor="var(--night)" />
        </radialGradient>
        <linearGradient id={`${id}-cloak`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cloak-500)" />
          <stop offset="100%" stopColor="var(--cloak)" />
        </linearGradient>
      </defs>
      <rect width={60} height={60} fill={`url(#${id}-bg)`} />
      <path d="M30 7C19 11 13 22 13 33c0 5 1 9 3 12-6 3-10 8-11 15h50c-1-7-5-12-11-15 2-3 3-7 3-12 0-11-6-22-17-26Z" fill={`url(#${id}-cloak)`} />
      <path d="M30 17c-7 3-10 10-10 17 0 4 1 7 3 9h14c2-2 3-5 3-9 0-7-3-14-10-17Z" fill="var(--night)" />
      <path d="M20 15c3-4 6-6 10-8" fill="none" stroke="rgb(244 236 218 / 0.22)" strokeWidth={1.2} strokeLinecap="round" />
      <text
        x={30}
        y={55}
        textAnchor="middle"
        fontSize={letters.length > 1 ? 9 : 10}
        fontWeight={600}
        letterSpacing={0.6}
        fill="var(--candle)"
        className="font-display"
      >
        {letters}
      </text>
    </svg>
  );
}

/** A bold red cross painted over the portrait, two strokes with a dry-brush edge. */
function PaintedX() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute -top-[6%] -left-[6%] h-[112%] w-[112%] drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]">
      <path d="M12 9c4-2 8 0 12 4l64 70c3 4 3 8 0 10-3 2-7 1-10-3L12 22c-4-4-4-10 0-13Z" fill="var(--blood)" />
      <path d="M91 12c2 4 0 8-4 12L23 90c-4 4-9 5-12 2s-1-8 3-12L78 13c4-4 10-5 13-1Z" fill="var(--blood)" />
      <path d="M16 12l70 75M86 15L18 86" stroke="var(--blood-hi)" strokeWidth={3} strokeLinecap="round" strokeDasharray="22 5 9 4 30 6" opacity={0.55} />
      <path d="M50 52c1 6 0 12 1 17 0 2-2 3-3 1-1-5 0-11 2-18Z" fill="var(--blood)" opacity={0.85} />
    </svg>
  );
}

interface HeadshotProps {
  name: string;
  /** The catalog's file name under /headshots/, or null before the photo pass. */
  image: string | null;
  size?: number;
  /** A round seat at the table rather than a framed portrait. */
  round?: boolean;
  /** How they left: banished or murdered crosses them off. Only ever what the API sent. */
  exit?: Exit | null;
  className?: string;
}

/** A player's portrait in a gilt frame, or a hooded figure until a photo exists. */
export function Headshot({ name, image, size = 48, round = false, exit, className }: HeadshotProps) {
  const portrait = (
    <Portrait
      name={name}
      src={image && `/headshots/${image}`}
      size={size}
      shape={round ? "round" : "frame"}
      fallback="hood"
      className={cn(eliminated(exit) && "brightness-75 grayscale", className)}
    />
  );
  if (!eliminated(exit)) return portrait;
  return (
    <span data-out={exit?.how} className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {portrait}
      <PaintedX />
    </span>
  );
}

interface AvatarProps {
  name: string | null;
  picture: string | null;
  size?: number;
  className?: string;
}

/** One of us: the Google picture, or initials. */
export function Avatar({ name, picture, size = 36, className }: AvatarProps) {
  return <Portrait name={name ?? "Player"} src={picture} size={size} shape="round" fallback="initials" className={className} />;
}
