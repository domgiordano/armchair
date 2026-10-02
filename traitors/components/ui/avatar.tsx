"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/ui";

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => Array.from(w)[0]).join("").toUpperCase() || "?";
}

interface PortraitProps {
  name: string;
  src: string | null;
  size: number;
  shape: "frame" | "round";
  className?: string;
}

function Portrait({ name, src, size, shape, className }: PortraitProps) {
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

interface HeadshotProps {
  name: string;
  /** The catalog's file name under /headshots/, or null before the photo pass. */
  image: string | null;
  size?: number;
  /** A round seat at the table rather than a framed portrait. */
  round?: boolean;
  className?: string;
}

/** A player's portrait in a gilt frame, or their initials until a photo exists. */
export function Headshot({ name, image, size = 48, round = false, className }: HeadshotProps) {
  return (
    <Portrait
      name={name}
      src={image && `/headshots/${image}`}
      size={size}
      shape={round ? "round" : "frame"}
      className={className}
    />
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
  return <Portrait name={name ?? "Player"} src={picture} size={size} shape="round" className={className} />;
}
