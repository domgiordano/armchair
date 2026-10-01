"use client";

import Image from "next/image";
import { useState } from "react";

import { initials } from "@/components/avatar";
import type { Person } from "@/lib/api/show";

interface HeadshotProps {
  person: Person;
}

export const headshotUrl = (file: string) => `/headshots/${encodeURIComponent(file)}`;

/** Decorative: every use sits beside the person's name. */
export function Headshot({ person }: HeadshotProps) {
  const [failed, setFailed] = useState(false);

  if (person.headshot && !failed) {
    return (
      <Image
        src={headshotUrl(person.headshot.file)}
        alt=""
        width={48}
        height={48}
        unoptimized
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-12 shrink-0 rounded-full bg-ballroom object-cover ring-2 ring-ink"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ballroom to-silver/30 text-sm font-semibold text-pearl ring-2 ring-ink"
    >
      {initials(person.name, "")}
    </span>
  );
}
