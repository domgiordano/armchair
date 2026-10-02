"use client";

import Image from "next/image";
import { useState } from "react";

import { initials } from "@/components/avatar";
import { headshotUrl } from "@/components/headshot";
import type { Person } from "@/lib/api/show";
import { cn } from "@/lib/ui";

interface PortraitProps {
  person: Person;
  /** Pixels on a side: the image is fetched at this size. */
  size: number;
  className?: string;
}

/** A large square headshot in a gold frame. Decorative: the name always sits beside it. */
export function Portrait({ person, size, className }: PortraitProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const image = person.headshot?.image;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-gold-light via-gold to-ballroom p-[2px] shadow-[0_18px_40px_-18px_rgb(232_194_104/0.55)]",
        className,
      )}
    >
      {image && failed !== image ? (
        <Image
          src={headshotUrl(image)}
          alt=""
          width={size}
          height={size}
          unoptimized
          onError={() => setFailed(image)}
          className="size-full rounded-[14px] bg-ballroom object-cover"
        />
      ) : (
        <span
          style={{ fontSize: Math.round(size * 0.3) }}
          className="flex size-full items-center justify-center rounded-[14px] bg-gradient-to-br from-ballroom to-ink font-semibold text-gold-light"
        >
          {initials(person.name, "")}
        </span>
      )}
    </span>
  );
}
