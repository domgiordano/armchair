"use client";

import Image from "next/image";
import { useState } from "react";

interface AvatarProps {
  name: string | null;
  email: string;
  picture: string | null;
  size?: number;
}

export function initials(name: string | null, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  const fromName = letters.map((w) => Array.from(w)[0]).join("");
  return (fromName || Array.from(email)[0] || "?").toUpperCase();
}

export function Avatar({ name, email, picture, size = 36 }: AvatarProps) {
  // Keyed by URL so a new picture gets a fresh try after an old one failed.
  const [failed, setFailed] = useState<string | null>(null);
  const label = name ?? email;

  if (picture && failed !== picture) {
    return (
      <Image
        src={picture}
        alt={label}
        width={size}
        height={size}
        unoptimized
        // Google's photo host refuses some requests that carry a Referer.
        referrerPolicy="no-referrer"
        onError={() => setFailed(picture)}
        style={{ width: size, height: size }}
        className="rounded-full bg-neutral-800 object-cover"
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      style={{ width: size, height: size, fontSize: size * 0.39 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-amber-300 font-semibold text-amber-950"
    >
      <span aria-hidden="true">{initials(name, email)}</span>
    </span>
  );
}
