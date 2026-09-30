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
        className="size-12 shrink-0 rounded-full bg-neutral-800 object-cover ring-2 ring-neutral-900"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-semibold text-neutral-100 ring-2 ring-neutral-900"
    >
      {initials(person.name, "")}
    </span>
  );
}
